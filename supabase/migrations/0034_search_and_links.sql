-- Busca que entende frases, pedidos ligados à categoria pelas palavras, e "Esse profissional já está no app?".
-- Depende de 0021, 0027, 0028, 0029 e 0030. Idempotente.

-- ───── palavras do dia a dia nas categorias ─────
update public.categories
   set keywords = trim(coalesce(keywords, '') || ' impressora impressoras scanner cartucho toner monitor mouse teclado periferico perifericos hp epson canon brother lexmark')
 where slug = 'computador' and coalesce(keywords, '') not like '%impressora%';

-- ───── palavras de busca acrescentadas pelos vizinhos (ao ligar um pedido a um perfil que já existe) ─────
alter table public.providers add column if not exists search_tags text check (search_tags is null or char_length(search_tags) <= 300);

create table if not exists public.request_links (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  label text not null,
  label_key text not null,
  group_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider_id, label_key)
);
create index if not exists request_links_group_idx on public.request_links (group_key, created_at desc);
alter table public.request_links enable row level security;   -- sem policies: só as funções
revoke all on public.request_links from anon, authenticated;

alter table public.indication_requests add column if not exists fulfilled_provider_id uuid references public.providers(id) on delete set null;

-- Palavras que importam de um texto: sem acento, sem palavras de conversa ("busco", "quem", "de"...). Se sobrar nada, usa todas.
drop function if exists public.search_tokens(text, int);
create or replace function public.search_tokens(p_q text, p_minlen int default 3, p_fallback boolean default true) returns text[]
language sql immutable set search_path = public as $$
  with raw as (
    select t from unnest(string_to_array(regexp_replace(lower(unaccent(trim(coalesce(p_q, '')))), '[^a-z0-9 ]', ' ', 'g'), ' ')) t where t <> ''
  ), good as (
    select distinct t from raw where char_length(t) >= p_minlen and t <> all (array['a','o','as','os','um','uma','uns','umas','de','da','do','das','dos','em','no','na','nos','nas','ao','aos','para','pra','pro','por','com','sem','e','ou','que','quem','qual','quais','onde','como','quando','alguem','algum','alguma','algumas','alguns','ninguem','busco','buscando','procuro','procurando','preciso','precisando','precisa','queria','quero','gostaria','indica','indicar','indicacao','indicam','indicado','favor','tem','ter','ha','existe','conhece','conhecem','voces','voce','vc','me','meu','minha','seu','sua','pessoa','profissional','profissionais','servico','servicos','fazer','faz','faco','fazem','bom','boa','bons','boas','bem','perto','aqui','condominio','vizinho','vizinhos','ajuda','urgente','pessoal','gente','la','ja','so','mais','muito','ser','estou','esta','estao','sao','foi','conserto','concerto','conserte','concerte','consertos','consertar','concertar','reparo','reparos','reparar','manutencao','instalacao','instalar','troca','trocar'])
  )
  select case when exists (select 1 from good) or not p_fallback then array(select t from good)
              else array(select distinct t from raw where char_length(t) >= 2) end;
$$;

-- Busca: qualquer palavra importante vale, e quem casa com mais palavras vem primeiro. `p_strict` (usado para decidir se um pedido
-- "já tem indicação") exige quase todas as palavras (3 de 4, 2 de 2...), para "afinador de piano" não ser atendido por um professor de piano.
drop function if exists public.search_provider_ids(uuid, text);
create or replace function public.search_provider_ids(p_condo uuid, p_q text, p_strict boolean default false)
returns table (id uuid, score real)
language sql stable set search_path = public as $$
  with toks as (select unnest(public.search_tokens(p_q)) as t),
  n as (select count(*)::int as n from toks),
  docs as (
    select p.id,
           lower(unaccent(p.name)) as n,
           lower(unaccent(p.description)) as d,
           lower(unaccent(coalesce((select string_agg(c.name || ' ' || c.keywords, ' ')
                                      from provider_categories pc join categories c on c.id = pc.category_id
                                     where pc.provider_id = p.id), '') || ' ' || coalesce(p.custom_category, ''))) as c,
           lower(unaccent(coalesce((select string_agg(sp.name || ' ' || sp.keywords, ' ')
                                      from provider_specialties ps join specialties sp on sp.id = ps.specialty_id
                                     where ps.provider_id = p.id), '') || ' ' || coalesce(p.custom_specialty, ''))) as s,
           lower(unaccent(coalesce(p.search_tags, ''))) as g
    from providers p
    where p.condo_id = any (public.condo_region_ids(p_condo)) and p.status = 'active'
  ), scored as (
    select docs.id,
           (select count(*) from toks
             where docs.n like '%' || t || '%' or docs.s like '%' || t || '%' or docs.c like '%' || t || '%'
                or docs.d like '%' || t || '%' or docs.g like '%' || t || '%'
                or word_similarity(t, docs.n) > 0.5 or word_similarity(t, docs.s) > 0.5 or word_similarity(t, docs.c) > 0.5) as matched,
           (select coalesce(avg(greatest(
              case when docs.n like '%' || t || '%' then 1.0 else 0.0 end,
              case when docs.s like '%' || t || '%' then 1.0 else 0.0 end,
              case when docs.g like '%' || t || '%' then 0.9 else 0.0 end,
              case when docs.c like '%' || t || '%' then 0.8 else 0.0 end,
              case when docs.d like '%' || t || '%' then 0.5 else 0.0 end,
              word_similarity(t, docs.n),
              word_similarity(t, docs.s),
              word_similarity(t, docs.c) * 0.8)), 0) from toks) as sc
      from docs
  )
  select scored.id, scored.sc::real
    from scored, n
   where n.n > 0 and scored.matched >= case when p_strict then greatest(1, ceil(n.n * 0.75)::int) else 1 end
   order by scored.matched desc, scored.sc desc
   limit 100;
$$;
grant execute on function public.search_provider_ids(uuid, text, boolean) to authenticated;

-- Categoria que um texto representa: nome/palavra-chave igual ao texto inteiro, ou pelas palavras da frase
-- (ignorando palavras que aparecem em muitas categorias).
create or replace function public.request_category(p_key text) returns int
language plpgsql stable security definer set search_path = public as $$
declare v int; toks text[];
begin
  -- só palavras de conversa ("conserto", "preciso de alguém"): não representa nenhuma categoria
  if cardinality(public.search_tokens(p_key, 3, false)) = 0 then return null; end if;
  select c.id into v from public.categories c
   where c.slug <> 'outros'
     and (public.request_norm(c.name) = p_key or public.request_norm(split_part(c.name, ' / ', 1)) = p_key
          or (char_length(p_key) >= 5 and public.request_norm(c.name || ' ' || coalesce(c.keywords, '')) like '%' || p_key || '%'))
   order by (public.request_norm(c.name) = p_key) desc, c.sort limit 1;
  if v is not null then return v; end if;
  toks := public.search_tokens(p_key, 4, false);
  if toks is null or cardinality(toks) = 0 then return null; end if;
  with t as (select unnest(toks) as t),
  cw as (
    select c.id, c.sort, w from public.categories c,
           unnest(string_to_array(public.request_norm(c.name || ' ' || coalesce(c.keywords, '')), ' ')) w
     where c.slug <> 'outros' and char_length(w) >= 4),
  tdf as (
    select t.t, count(distinct cw.id) as df from t join cw on (cw.w = t.t or cw.w like t.t || '%' or t.t like cw.w || '%') group by t.t),
  hits as (
    select cw.id, cw.sort, count(distinct t.t) as hits
      from t join tdf on tdf.t = t.t and tdf.df <= 5
      join cw on (cw.w = t.t or cw.w like t.t || '%' or t.t like cw.w || '%')
     group by cw.id, cw.sort)
  select id into v from hits order by hits desc, sort limit 1;
  return v;
end $$;

create or replace function public.request_has_providers(p_condo uuid, p_label text, p_category int) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_category is not null then exists (
      select 1 from public.provider_categories pc join public.providers p on p.id = pc.provider_id
       where pc.category_id = p_category and p.status = 'active' and p.condo_id = any (public.condo_region_ids(p_condo)))
    else exists (select 1 from public.search_provider_ids(p_condo, p_label, true))
  end;
$$;
create or replace function public.request_match_recipients(p_provider uuid)
returns table (request_id uuid, email text, label text, condo_slug text, category_slug text, provider_name text)
language sql stable security definer set search_path = public as $$
  select r.id, u.email::text, r.label, k.slug, c.slug, p.name
    from public.providers p
    join public.indication_requests r on r.status = 'open' and r.notify_email and r.emailed_at is null
         and r.condo_id = any (public.condo_region_ids(p.condo_id))
    join auth.users u on u.id = r.user_id
    join public.condominiums k on k.id = r.condo_id and k.is_active
    left join public.categories c on c.id = r.category_id
   where p.id = p_provider and p.status = 'active'
     and r.user_id is distinct from p.created_by and r.user_id is distinct from p.owner_id
     and ((r.category_id is not null and exists (select 1 from public.provider_categories pc where pc.provider_id = p.id and pc.category_id = r.category_id))
          or (r.category_id is null and exists (select 1 from public.search_provider_ids(r.condo_id, r.label, true) s where s.id = p.id))
          or r.fulfilled_provider_id = p.id);
$$;
create or replace function public.request_indication(p_condo uuid, p_label text, p_notify boolean default true) returns text
language plpgsql security definer set search_path = public as $$
declare v_label text := regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g'); v_key text; v_cat int; v_flag text; v_status text := 'open';
begin
  if auth.uid() is null or not public.is_member(p_condo) then raise exception 'sem permissão'; end if;
  if char_length(v_label) not between 2 and 60 then raise exception 'texto_invalido'; end if;
  v_key := public.request_norm(v_label);
  if (select count(*) from public.indication_requests where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'limite_diario';
  end if;
  v_cat := public.request_category(v_key);
  if public.request_has_providers(p_condo, v_label, v_cat) then return 'ja_existe'; end if;
  if exists (select 1 from public.indication_requests where user_id = auth.uid() and label_key = v_key and status in ('open','review')) then
    if p_notify then
      update public.indication_requests set notify_email = true
       where user_id = auth.uid() and label_key = v_key and status in ('open','review') and not notify_email;
    end if;
    return 'ja_pediu';
  end if;
  v_flag := public.content_flags(null, v_label, null, null);
  if v_flag is not null then v_status := 'review'; end if;
  insert into public.indication_requests (condo_id, user_id, label, label_key, category_id, status, flag_reason, notify_email)
  values (p_condo, auth.uid(), v_label, v_key, v_cat, v_status, v_flag, coalesce(p_notify, false));
  return case when v_status = 'review' then 'em_analise' else 'ok' end;
end $$;

-- Liga um pedido a um perfil que já está no app: o pedido é atendido, quem pediu é avisado e o perfil passa a ser achado
-- pelas palavras do pedido (sem mudar a categoria dele).
create or replace function public.link_request_provider(p_condo uuid, p_label text, p_provider uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_label text := regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g'); v_key text; v_cat int; v_group text; p public.providers; v_new text;
begin
  if auth.uid() is null or not public.is_member(p_condo) then raise exception 'sem permissão'; end if;
  if char_length(v_label) not between 2 and 60 then raise exception 'texto_invalido'; end if;
  select * into p from public.providers where id = p_provider and status = 'active';
  if p.id is null or not (p.condo_id = any (public.condo_region_ids(p_condo))) then raise exception 'perfil_invalido'; end if;
  if (select count(*) from public.request_links where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then raise exception 'limite_diario'; end if;
  v_key := public.request_norm(v_label);
  v_cat := public.request_category(v_key);
  v_group := coalesce('c' || v_cat::text, v_key);
  insert into public.request_links (condo_id, user_id, provider_id, label, label_key, group_key)
  values (p_condo, auth.uid(), p_provider, v_label, v_key, v_group)
  on conflict (user_id, provider_id, label_key) do nothing;
  if public.content_flags(null, v_label, null, null) is null then
    v_new := array_to_string(array(
      select t from unnest(public.search_tokens(v_key, 3)) t
       where position(t in coalesce(p.search_tags, '') || ' ' || public.request_norm(p.name || ' ' || coalesce(p.description, ''))) = 0), ' ');
    if v_new <> '' then
      update public.providers set search_tags = left(trim(coalesce(search_tags, '') || ' ' || v_new), 300) where id = p.id;
    end if;
  end if;
  update public.indication_requests r set fulfilled_provider_id = p_provider
   where r.status = 'open' and r.fulfilled_provider_id is null and r.condo_id = any (public.condo_region_ids(p_condo))
     and coalesce('c' || r.category_id::text, r.label_key) = v_group;
  return 'ok';
end $$;
grant execute on function public.link_request_provider(uuid, text, uuid) to authenticated;

drop function if exists public.open_requests(uuid);
create or replace function public.open_requests(p_condo uuid)
returns table (group_key text, label text, category_slug text, n bigint, i_asked boolean, i_notify boolean, i_searched boolean)
language plpgsql stable security definer set search_path = public as $$
declare g record;
begin
  if auth.uid() is null or not public.is_member(p_condo) then return; end if;
  for g in
    with src as (
      select r.user_id, r.label, r.label_key, r.category_id, true as explicit, r.notify_email as notify, r.created_at
        from public.indication_requests r
       where r.status = 'open' and r.condo_id = any (public.condo_region_ids(p_condo)) and r.created_at > now() - interval '30 days'
      union all
      select m.user_id, m.label, m.label_key, m.category_id, false, false, m.created_at
        from public.search_misses m
       where m.condo_id = any (public.condo_region_ids(p_condo)) and m.created_at > now() - interval '30 days'
    )
    select coalesce('c' || s.category_id::text, s.label_key) as k, min(s.label) as lbl, max(s.category_id) as cat,
           count(distinct s.user_id) as cnt,
           bool_or(s.explicit) as has_explicit,
           bool_or(s.user_id = auth.uid() and s.explicit) as mine,
           bool_or(s.user_id = auth.uid() and s.explicit and s.notify) as mine_notify,
           bool_or(s.user_id = auth.uid() and not s.explicit) as mine_search,
           max(s.created_at) as last_at
      from src s group by 1
     order by count(distinct s.user_id) desc, max(s.created_at) desc limit 30
  loop
    if exists (select 1 from public.request_links l where l.group_key = g.k and l.created_at > now() - interval '30 days' and l.condo_id = any (public.condo_region_ids(p_condo))) then continue; end if;
    if exists (select 1 from public.request_hidden h where h.condo_id = any (public.condo_region_ids(p_condo)) and h.group_key = g.k) then continue; end if;
    if public.request_has_providers(p_condo, g.lbl, g.cat) then continue; end if;
    group_key := g.k;
    label := coalesce((select split_part(c.name, ' / ', 1) from public.categories c where c.id = g.cat), g.lbl);
    category_slug := (select c.slug from public.categories c where c.id = g.cat);
    n := g.cnt; i_asked := g.mine; i_notify := g.mine_notify; i_searched := g.mine_search;
    return next;
  end loop;
end $$;
grant execute on function public.open_requests(uuid) to authenticated;

-- Meus pedidos que agora têm indicação (inclui o perfil indicado por um vizinho, quando houver).
drop function if exists public.my_request_updates(uuid);
create or replace function public.my_request_updates(p_condo uuid)
returns table (id uuid, label text, category_slug text, provider_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null or not public.is_member(p_condo) then return; end if;
  for r in select * from public.indication_requests
            where user_id = auth.uid() and status = 'open' and notified_at is null order by created_at limit 10
  loop
    if r.fulfilled_provider_id is not null or public.request_has_providers(p_condo, r.label, r.category_id) then
      id := r.id; label := r.label; provider_id := r.fulfilled_provider_id;
      category_slug := (select c.slug from public.categories c where c.id = r.category_id);
      return next;
    end if;
  end loop;
end $$;
grant execute on function public.my_request_updates(uuid) to authenticated;
