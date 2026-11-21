-- "Os vizinhos estão procurando": pedidos de indicação ainda sem prestador. Valem para a REGIÃO toda (condomínios vizinhos somam).
-- Só aparece contagem e o nome do serviço: nunca quem pediu. Pedidos com texto suspeito esperam o admin. Idempotente.

create table if not exists public.indication_requests (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,   -- condomínio de quem pediu
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 60),
  label_key text not null,                       -- texto normalizado (sem acento/caixa) para agrupar
  category_id int references public.categories(id) on delete set null,   -- quando o texto bate com uma categoria
  status text not null default 'open' check (status in ('open','review','hidden','closed')),
  flag_reason text,
  notified_at timestamptz,                       -- quando o morador foi avisado de que apareceu indicação
  created_at timestamptz not null default now()
);
create unique index if not exists indication_requests_one_open on public.indication_requests (user_id, label_key) where status in ('open','review');
create index if not exists indication_requests_condo_idx on public.indication_requests (condo_id, status, created_at desc);
alter table public.indication_requests enable row level security;   -- sem policies: só as funções abaixo
revoke all on public.indication_requests from anon, authenticated;

create or replace function public.request_norm(p text) returns text
language sql immutable set search_path = public as $$
  select trim(regexp_replace(lower(unaccent(coalesce(p, ''))), '\s+', ' ', 'g'));
$$;

-- Já existe indicação para este pedido na região? (por categoria, ou pela busca do app)
create or replace function public.request_has_providers(p_condo uuid, p_label text, p_category int) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_category is not null then exists (
      select 1 from public.provider_categories pc join public.providers p on p.id = pc.provider_id
       where pc.category_id = p_category and p.status = 'active' and p.condo_id = any (public.condo_region_ids(p_condo)))
    else exists (select 1 from public.search_provider_ids(p_condo, p_label))
  end;
$$;

-- O morador faz um pedido. Devolve: 'ok', 'ja_existe' (já há indicação), 'ja_pediu' ou 'em_analise' (texto suspeito).
create or replace function public.request_indication(p_condo uuid, p_label text) returns text
language plpgsql security definer set search_path = public as $$
declare v_label text := regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g'); v_key text; v_cat int; v_flag text; v_status text := 'open';
begin
  if auth.uid() is null or not public.is_member(p_condo) then raise exception 'sem permissão'; end if;
  if char_length(v_label) not between 2 and 60 then raise exception 'texto_invalido'; end if;
  v_key := public.request_norm(v_label);
  if (select count(*) from public.indication_requests where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'limite_diario';
  end if;
  select c.id into v_cat from public.categories c
   where c.slug <> 'outros'
     and (public.request_norm(c.name) = v_key or public.request_norm(split_part(c.name, ' / ', 1)) = v_key
          or (char_length(v_key) >= 5 and public.request_norm(c.name || ' ' || coalesce(c.keywords, '')) like '%' || v_key || '%'))
   order by (public.request_norm(c.name) = v_key) desc, c.sort limit 1;
  if public.request_has_providers(p_condo, v_label, v_cat) then return 'ja_existe'; end if;
  if exists (select 1 from public.indication_requests where user_id = auth.uid() and label_key = v_key and status in ('open','review')) then
    return 'ja_pediu';
  end if;
  v_flag := public.content_flags(null, v_label, null, null);
  if v_flag is not null then v_status := 'review'; end if;
  insert into public.indication_requests (condo_id, user_id, label, label_key, category_id, status, flag_reason)
  values (p_condo, auth.uid(), v_label, v_key, v_cat, v_status, v_flag);
  return case when v_status = 'review' then 'em_analise' else 'ok' end;
end $$;
grant execute on function public.request_indication(uuid, text) to authenticated;

-- O morador retira o próprio pedido.
create or replace function public.cancel_indication_request(p_condo uuid, p_key text) returns void
language sql security definer set search_path = public as $$
  update public.indication_requests set status = 'closed'
   where user_id = auth.uid() and label_key = public.request_norm(p_key) and status in ('open','review')
     and public.is_member(p_condo);
$$;
grant execute on function public.cancel_indication_request(uuid, text) to authenticated;

-- Pedidos em aberto na região, agrupados, que ainda NÃO têm indicação (últimos 30 dias).
create or replace function public.open_requests(p_condo uuid)
returns table (group_key text, label text, category_slug text, n bigint, i_asked boolean)
language plpgsql stable security definer set search_path = public as $$
declare g record;
begin
  if auth.uid() is null or not public.is_member(p_condo) then return; end if;
  for g in
    select coalesce('c' || r.category_id::text, r.label_key) as k,
           min(r.label) as lbl, max(r.category_id) as cat, count(distinct r.user_id) as cnt,
           bool_or(r.user_id = auth.uid()) as mine, max(r.created_at) as last_at
      from public.indication_requests r
     where r.status = 'open' and r.condo_id = any (public.condo_region_ids(p_condo)) and r.created_at > now() - interval '30 days'
     group by 1 order by count(distinct r.user_id) desc, max(r.created_at) desc limit 30
  loop
    if public.request_has_providers(p_condo, g.lbl, g.cat) then continue; end if;
    group_key := g.k;
    label := coalesce((select split_part(c.name, ' / ', 1) from public.categories c where c.id = g.cat), g.lbl);
    category_slug := (select c.slug from public.categories c where c.id = g.cat);
    n := g.cnt; i_asked := g.mine;
    return next;
  end loop;
end $$;
grant execute on function public.open_requests(uuid) to authenticated;

-- Meus pedidos que agora têm indicação (para avisar uma vez na home).
create or replace function public.my_request_updates(p_condo uuid)
returns table (id uuid, label text, category_slug text)
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null or not public.is_member(p_condo) then return; end if;
  for r in select * from public.indication_requests
            where user_id = auth.uid() and status = 'open' and notified_at is null order by created_at limit 10
  loop
    if public.request_has_providers(p_condo, r.label, r.category_id) then
      id := r.id; label := r.label; category_slug := (select c.slug from public.categories c where c.id = r.category_id);
      return next;
    end if;
  end loop;
end $$;
grant execute on function public.my_request_updates(uuid) to authenticated;

create or replace function public.ack_request_update(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.indication_requests set notified_at = now(), status = 'closed' where id = p_id and user_id = auth.uid();
$$;
grant execute on function public.ack_request_update(uuid) to authenticated;

-- Admin: pedidos com texto suspeito aguardando análise (do próprio condomínio) e decisão.
create or replace function public.admin_pending_requests(p_condo uuid)
returns table (id uuid, label text, flag_reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.label, r.flag_reason, r.created_at from public.indication_requests r
   where public.is_admin(p_condo) and r.condo_id = p_condo and r.status = 'review' order by r.created_at;
$$;
grant execute on function public.admin_pending_requests(uuid) to authenticated;

create or replace function public.admin_decide_request(p_condo uuid, p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  update public.indication_requests set status = case when p_approve then 'open' else 'hidden' end
   where id = p_id and condo_id = p_condo and status = 'review';
end $$;
grant execute on function public.admin_decide_request(uuid, uuid, boolean) to authenticated;
