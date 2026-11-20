-- Região: condomínios vizinhos que compartilham a base de prestadores e de avaliações.
-- Cada condomínio continua com seus moradores, administrador, avisos, anúncios e chaves; só a lista de prestadores é comum.
-- Sem região, nada muda (cada condomínio vê só os seus). Idempotente.

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.regions enable row level security;   -- sem policies: gerida pelo script supabase/tools/criar_regiao.sql
alter table public.condominiums add column if not exists region_id uuid references public.regions(id) on delete set null;
create index if not exists condominiums_region_idx on public.condominiums (region_id);

-- Condomínios da mesma região (inclui o próprio; se não há região, só ele).
create or replace function public.condo_region_ids(p_condo uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select array_agg(k.id) from public.condominiums k
      where k.region_id is not null and k.region_id = (select region_id from public.condominiums where id = p_condo)),
    array[p_condo]);
$$;
grant execute on function public.condo_region_ids(uuid) to authenticated;

-- A pessoa é moradora do condomínio, ou de outro da mesma região.
create or replace function public.can_view_condo(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.members m where m.user_id = auth.uid() and m.condo_id = any (public.condo_region_ids(c)));
$$;
grant execute on function public.can_view_condo(uuid) to authenticated;

-- ───── Leitura entre condomínios da região ─────
drop policy if exists condos_read on public.condominiums;
create policy condos_read on public.condominiums for select to authenticated using (public.can_view_condo(id));

drop policy if exists providers_read on public.providers;
create policy providers_read on public.providers for select to authenticated
  using (public.can_view_condo(condo_id) and (status = 'active' or public.is_admin(condo_id)));

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to authenticated
  using (public.can_view_condo(condo_id) and (status = 'visible' or public.is_admin(condo_id)));
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert to authenticated
  with check (public.can_view_condo(condo_id) and author_id = auth.uid() and status = 'visible');

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (public.can_view_condo(condo_id) and reporter_id = auth.uid() and status = 'open');

drop policy if exists provider_categories_read on public.provider_categories;
create policy provider_categories_read on public.provider_categories for select to authenticated using (public.can_view_condo(condo_id));
drop policy if exists provider_specialties_read on public.provider_specialties;
create policy provider_specialties_read on public.provider_specialties for select to authenticated using (public.can_view_condo(condo_id));
drop policy if exists provider_services_read on public.provider_services;
create policy provider_services_read on public.provider_services for select to authenticated using (public.can_view_condo(condo_id));
drop policy if exists provider_photos_read on public.provider_photos;
create policy provider_photos_read on public.provider_photos for select to authenticated using (public.can_view_condo(condo_id));

-- ───── Avaliações: de onde vem o autor ─────
-- reviews.condo_id continua sendo o do PRESTADOR (assim moderação, denúncias e métricas seguem com o condomínio de origem).
alter table public.reviews add column if not exists author_origin text;   -- nome do condomínio do autor, quando é de outro

create or replace function public.reviews_set_label() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.members; p public.providers; parts text[]; short text; v_condo_name text;
begin
  select * into p from public.providers where id = new.provider_id;
  if p.id is null or p.condo_id <> new.condo_id then raise exception 'prestador inválido'; end if;
  -- prefere o cadastro no condomínio do prestador; senão, em outro da região
  select * into m from public.members where user_id = new.author_id and condo_id = new.condo_id;
  if m.user_id is null then
    select * into m from public.members
     where user_id = new.author_id and condo_id = any (public.condo_region_ids(new.condo_id)) order by created_at limit 1;
  end if;
  if m.user_id is null then raise exception 'não é morador deste condomínio'; end if;
  parts := regexp_split_to_array(trim(m.full_name), '\s+');
  short := parts[1] || case when array_length(parts,1) > 1 then ' ' || upper(left(parts[array_length(parts,1)],1)) || '.' else '' end;
  if m.condo_id = new.condo_id then
    new.author_label := short || ' · Bloco ' || m.block;
    new.author_origin := null;
  else
    select name into v_condo_name from public.condominiums where id = m.condo_id;
    new.author_label := short || ' · ' || v_condo_name;   -- nunca guarda o bloco de quem é de outro condomínio
    new.author_origin := v_condo_name;
  end if;
  return new;
end $$;

-- Quem modera avaliações e denúncias é o administrador do condomínio do prestador (condo_id deles).

-- ───── Eventos: de qual condomínio é quem visitou ─────
alter table public.provider_events add column if not exists viewer_condo_id uuid references public.condominiums(id) on delete set null;
update public.provider_events set viewer_condo_id = condo_id where viewer_condo_id is null;
create index if not exists provider_events_viewer_idx on public.provider_events (viewer_condo_id, created_at desc);

drop function if exists public.log_provider_event(uuid, text);
create or replace function public.log_provider_event(p_provider uuid, p_kind text, p_viewer_condo uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare p public.providers; v_viewer uuid;
begin
  if p_kind not in ('view','whatsapp','instagram','website') or auth.uid() is null then return; end if;
  select * into p from public.providers where id = p_provider;
  if p.id is null or p.status <> 'active' or not public.can_view_condo(p.condo_id) then return; end if;
  if p.owner_id = auth.uid() then return; end if;
  -- condomínio de quem visita: o informado (se a pessoa é moradora dele), senão o do prestador, senão o primeiro da região
  if p_viewer_condo is not null and exists (select 1 from public.members where user_id = auth.uid() and condo_id = p_viewer_condo)
     and p_viewer_condo = any (public.condo_region_ids(p.condo_id)) then
    v_viewer := p_viewer_condo;
  elsif exists (select 1 from public.members where user_id = auth.uid() and condo_id = p.condo_id) then
    v_viewer := p.condo_id;
  else
    select condo_id into v_viewer from public.members
     where user_id = auth.uid() and condo_id = any (public.condo_region_ids(p.condo_id)) order by created_at limit 1;
  end if;
  if exists (select 1 from public.provider_events
              where provider_id = p_provider and user_id = auth.uid() and kind = p_kind
                and created_at > now() - (case when p_kind = 'view' then interval '30 minutes' else interval '1 minute' end)) then
    return;
  end if;
  insert into public.provider_events (provider_id, condo_id, user_id, kind, viewer_condo_id)
  values (p_provider, p.condo_id, auth.uid(), p_kind, v_viewer);
end $$;
grant execute on function public.log_provider_event(uuid, text, uuid) to authenticated;

-- Indicadores do condomínio contam as ações dos MORADORES dele (mesmo em prestadores de outro condomínio).
create or replace function public.condo_stats(p_condo uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 90);
  v_from_ts timestamptz := (((now() at time zone 'America/Sao_Paulo')::date - (least(greatest(coalesce(p_days, 30), 1), 90) - 1))::timestamp at time zone 'America/Sao_Paulo');
  totals jsonb; top jsonb;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  select jsonb_build_object(
           'views', count(*) filter (where kind = 'view'),
           'viewers', count(distinct user_id) filter (where kind = 'view'),
           'whatsapp', count(*) filter (where kind = 'whatsapp'),
           'members', (select count(*) from public.members where condo_id = p_condo),
           'owners', (select count(*) from public.providers where condo_id = p_condo and owner_id is not null),
           'providers', (select count(*) from public.providers where condo_id = p_condo and status = 'active'))
    into totals from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and created_at >= v_from_ts;
  select coalesce(jsonb_agg(t order by (t->>'whatsapp')::int desc, (t->>'views')::int desc), '[]'::jsonb) into top
    from (select jsonb_build_object('id', e.provider_id, 'name', p.name,
                  'whatsapp', count(*) filter (where e.kind = 'whatsapp'),
                  'views', count(*) filter (where e.kind = 'view')) as t
            from public.provider_events e join public.providers p on p.id = e.provider_id
           where coalesce(e.viewer_condo_id, e.condo_id) = p_condo and e.created_at >= v_from_ts
           group by e.provider_id, p.name
           order by count(*) filter (where e.kind = 'whatsapp') desc, count(*) filter (where e.kind = 'view') desc
           limit 5) x;
  return jsonb_build_object('days', v_days, 'totals', totals, 'top', top);
end $$;
grant execute on function public.condo_stats(uuid, int) to authenticated;

create or replace function public.growth_stats(p_condo uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 90);
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_from date; v_from_ts timestamptz; v_prev_ts timestamptz; v_7_ts timestamptz;
  series jsonb; tot jsonb; prev jsonb; snap jsonb; eng jsonb; cats jsonb; gaps jsonb; blocks jsonb;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  v_from := v_today - (v_days - 1);
  v_from_ts := (v_from::timestamp at time zone 'America/Sao_Paulo');
  v_prev_ts := ((v_from - v_days)::timestamp at time zone 'America/Sao_Paulo');
  v_7_ts := ((v_today - 6)::timestamp at time zone 'America/Sao_Paulo');

  select coalesce(jsonb_agg(jsonb_build_object(
           'd', to_char(g.d, 'YYYY-MM-DD'),
           'members', coalesce(m.n, 0), 'providers', coalesce(p.n, 0), 'reviews', coalesce(r.n, 0),
           'viewers', coalesce(e.viewers, 0), 'whatsapp', coalesce(e.whatsapp, 0)) order by g.d), '[]'::jsonb)
    into series
    from (select generate_series(v_from, v_today, interval '1 day')::date as d) g
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from public.members
                where condo_id = p_condo and created_at >= v_from_ts group by 1) m on m.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from public.providers
                where condo_id = p_condo and created_at >= v_from_ts group by 1) p on p.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from public.reviews
                where condo_id = p_condo and status = 'visible' and created_at >= v_from_ts group by 1) r on r.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d,
                      count(distinct user_id) filter (where kind = 'view') viewers,
                      count(*) filter (where kind = 'whatsapp') whatsapp
                 from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and created_at >= v_from_ts group by 1) e on e.d = g.d;

  select jsonb_build_object(
    'members', (select count(*) from public.members where condo_id = p_condo and created_at >= v_from_ts),
    'providers', (select count(*) from public.providers where condo_id = p_condo and created_at >= v_from_ts),
    'reviews', (select count(*) from public.reviews where condo_id = p_condo and status = 'visible' and created_at >= v_from_ts),
    'viewers', (select count(distinct user_id) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'view' and created_at >= v_from_ts),
    'views', (select count(*) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'view' and created_at >= v_from_ts),
    'whatsapp', (select count(*) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'whatsapp' and created_at >= v_from_ts))
    into tot;
  select jsonb_build_object(
    'members', (select count(*) from public.members where condo_id = p_condo and created_at >= v_prev_ts and created_at < v_from_ts),
    'providers', (select count(*) from public.providers where condo_id = p_condo and created_at >= v_prev_ts and created_at < v_from_ts),
    'reviews', (select count(*) from public.reviews where condo_id = p_condo and status = 'visible' and created_at >= v_prev_ts and created_at < v_from_ts),
    'viewers', (select count(distinct user_id) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'view' and created_at >= v_prev_ts and created_at < v_from_ts),
    'views', (select count(*) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'view' and created_at >= v_prev_ts and created_at < v_from_ts),
    'whatsapp', (select count(*) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'whatsapp' and created_at >= v_prev_ts and created_at < v_from_ts))
    into prev;

  select jsonb_build_object(
    'members', (select count(*) from public.members where condo_id = p_condo),
    'providers', (select count(*) from public.providers where condo_id = p_condo and status = 'active'),
    'residents', (select count(*) from public.providers where condo_id = p_condo and status = 'active' and kind = 'resident'),
    'owners', (select count(*) from public.providers where condo_id = p_condo and status = 'active' and owner_id is not null),
    'reviewed', (select count(distinct r.provider_id) from public.reviews r join public.providers p on p.id = r.provider_id
                  where r.condo_id = p_condo and r.status = 'visible' and p.status = 'active'),
    'reviews', (select count(*) from public.reviews where condo_id = p_condo and status = 'visible'))
    into snap;

  -- engajamento: quantos moradores usam de verdade
  select jsonb_build_object(
    'active7', (select count(distinct user_id) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and created_at >= v_7_ts),
    'active_period', (select count(distinct user_id) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and created_at >= v_from_ts),
    'returning', (select count(*) from (select user_id from public.provider_events
                   where condo_id = p_condo and created_at >= v_from_ts and user_id is not null
                   group by user_id having count(distinct (created_at at time zone 'America/Sao_Paulo')::date) >= 2) x),
    'contacted', (select count(distinct user_id) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'whatsapp' and created_at >= v_from_ts))
    into eng;

  -- categorias mais procuradas (cliques/visitas no período) e quantos perfis ativos cada uma tem
  select coalesce(jsonb_agg(t order by (t->>'whatsapp')::int desc, (t->>'views')::int desc), '[]'::jsonb) into cats
    from (select jsonb_build_object('name', c.name, 'icon', c.icon,
                   'whatsapp', count(*) filter (where e.kind = 'whatsapp'),
                   'views', count(*) filter (where e.kind = 'view'),
                   'providers', (select count(*) from public.providers q where q.condo_id = p_condo and q.status = 'active' and q.category_id = c.id)) t
            from public.provider_events e join public.providers p on p.id = e.provider_id join public.categories c on c.id = p.category_id
           where coalesce(e.viewer_condo_id, e.condo_id) = p_condo and e.created_at >= v_from_ts and e.kind in ('view','whatsapp')
           group by c.id, c.name, c.icon
           order by count(*) filter (where e.kind = 'whatsapp') desc, count(*) filter (where e.kind = 'view') desc limit 6) x;

  -- procura sem oferta: categorias com visitas no período e até 2 perfis
  select coalesce(jsonb_agg(t order by (t->>'views')::int desc), '[]'::jsonb) into gaps
    from (select jsonb_build_object('name', c.name, 'icon', c.icon, 'views', count(*), 'providers',
                   (select count(*) from public.providers q where q.condo_id = p_condo and q.status = 'active' and q.category_id = c.id)) t
            from public.provider_events e join public.providers p on p.id = e.provider_id join public.categories c on c.id = p.category_id
           where coalesce(e.viewer_condo_id, e.condo_id) = p_condo and e.created_at >= v_from_ts and e.kind = 'view'
           group by c.id, c.name, c.icon
          having (select count(*) from public.providers q where q.condo_id = p_condo and q.status = 'active' and q.category_id = c.id) <= 2
           order by count(*) desc limit 5) x;

  -- adesão por bloco (moradores cadastrados)
  select coalesce(jsonb_agg(jsonb_build_object('block', block, 'n', n) order by n desc, block), '[]'::jsonb) into blocks
    from (select block, count(*) n from public.members where condo_id = p_condo group by block order by count(*) desc, block limit 10) b;

  return jsonb_build_object('days', v_days, 'series', series, 'totals', tot, 'prev', prev, 'snapshot', snap,
                            'engagement', eng, 'categories', cats, 'gaps', gaps, 'blocks', blocks);
end $$;
grant execute on function public.growth_stats(uuid, int) to authenticated;

create or replace function public.review_prompts(p_condo uuid)
returns table (provider_id uuid, name text, category_name text, category_icon text, contacted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.provider_id, p.name, c.name, c.icon, x.contacted_at
    from (select e.provider_id, max(e.created_at) as contacted_at
            from public.provider_events e
           where e.user_id = auth.uid() and coalesce(e.viewer_condo_id, e.condo_id) = p_condo and e.kind = 'whatsapp'
             and e.created_at <= now() - interval '1 day' and e.created_at > now() - interval '14 days'
           group by e.provider_id) x
    join public.providers p on p.id = x.provider_id and p.status = 'active' and p.condo_id = any (public.condo_region_ids(p_condo))
    join public.categories c on c.id = p.category_id
   where public.is_member(p_condo)
     and p.owner_id is distinct from auth.uid()
     and not exists (select 1 from public.reviews r where r.provider_id = x.provider_id and r.author_id = auth.uid())
     and not exists (select 1 from public.review_prompt_dismissed d where d.provider_id = x.provider_id and d.user_id = auth.uid())
   order by x.contacted_at desc
   limit 2;
$$;
grant execute on function public.review_prompts(uuid) to authenticated;

-- ───── Prestadores: busca, duplicidade e listagem na região ─────
create or replace function public.search_provider_ids(p_condo uuid, p_q text)
returns table (id uuid, score real)
language sql stable set search_path = public as $$
  with toks as (
    select t from unnest(string_to_array(
      regexp_replace(lower(unaccent(trim(coalesce(p_q, '')))), '[%_\\]', '', 'g'), ' ')) as t
    where char_length(t) >= 2
  ), docs as (
    select p.id,
           lower(unaccent(p.name)) as n,
           lower(unaccent(p.description)) as d,
           lower(unaccent(coalesce((select string_agg(c.name || ' ' || c.keywords, ' ')
                                      from provider_categories pc join categories c on c.id = pc.category_id
                                     where pc.provider_id = p.id), '') || ' ' || coalesce(p.custom_category, ''))) as c,
           lower(unaccent(coalesce((select string_agg(sp.name || ' ' || sp.keywords, ' ')
                                      from provider_specialties ps join specialties sp on sp.id = ps.specialty_id
                                     where ps.provider_id = p.id), '') || ' ' || coalesce(p.custom_specialty, ''))) as s
    from providers p
    where p.condo_id = any (public.condo_region_ids(p_condo)) and p.status = 'active'
  )
  select docs.id,
         (select coalesce(avg(greatest(
              case when docs.n like '%' || t || '%' then 1.0 else 0.0 end,
              case when docs.s like '%' || t || '%' then 1.0 else 0.0 end,
              case when docs.c like '%' || t || '%' then 0.8 else 0.0 end,
              case when docs.d like '%' || t || '%' then 0.5 else 0.0 end,
              word_similarity(t, docs.n),
              word_similarity(t, docs.s),
              word_similarity(t, docs.c) * 0.8)), 0) from toks)::real as score
  from docs
  where exists (select 1 from toks)
    and not exists (
      select 1 from toks
      where not (docs.n like '%' || t || '%'
              or docs.s like '%' || t || '%'
              or docs.c like '%' || t || '%'
              or docs.d like '%' || t || '%'
              or word_similarity(t, docs.n) > 0.5
              or word_similarity(t, docs.s) > 0.5
              or word_similarity(t, docs.c) > 0.5))
  order by score desc
  limit 100;
$$;
grant execute on function public.search_provider_ids(uuid, text) to authenticated;

-- O mesmo WhatsApp não pode se repetir na região (dentro do condomínio já era único).
create or replace function public.providers_region_unique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.providers p
              where p.whatsapp = new.whatsapp and p.id is distinct from new.id
                and p.condo_id = any (public.condo_region_ids(new.condo_id))) then
    raise exception 'WhatsApp já cadastrado na região' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists providers_region_unique_trg on public.providers;
create trigger providers_region_unique_trg before insert or update of whatsapp on public.providers
  for each row execute function public.providers_region_unique();

create or replace function public.providers_check_flags() returns trigger
language plpgsql security definer set search_path = public as $$
declare similar_name text; recent int; cat_slug text; v_content text;
begin
  -- O cliente nunca define moderação: sempre recalculamos aqui.
  new.status := 'active';
  new.flagged := false;
  new.flag_reason := null;
  new.custom_category_reviewed := false;
  select slug into cat_slug from public.categories where id = new.category_id;
  if cat_slug is distinct from 'outros' then new.custom_category := null; end if;
  new.custom_category := nullif(trim(new.custom_category), '');

  select p.name into similar_name from public.providers p
   where p.condo_id = any (public.condo_region_ids(new.condo_id)) and p.category_id = new.category_id
     and similarity(lower(p.name), lower(new.name)) > 0.55
   order by similarity(lower(p.name), lower(new.name)) desc limit 1;
  if similar_name is not null then
    new.flagged := true;
    new.flag_reason := 'Nome parecido com "' || similar_name || '" na mesma categoria';
  end if;
  select count(*) into recent from public.providers
   where created_by = new.created_by and created_at > now() - interval '24 hours';
  if recent >= 5 then
    new.flagged := true;
    new.flag_reason := coalesce(new.flag_reason || '; ', '') || 'Mesmo morador cadastrou muitos prestadores em 24h';
  end if;
  v_content := public.content_flags(new.name, new.description, coalesce(new.custom_category, '') || ' ' || coalesce(new.custom_specialty, ''), new.website);
  if v_content is not null then
    new.flagged := true;
    new.flag_reason := coalesce(new.flag_reason || '; ', '') || v_content;
  end if;
  return new;
end $$;


-- Pedir para assumir um perfil: vale para quem é da região.
create or replace function public.request_profile_claim(p_provider uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.providers; v_id uuid;
begin
  select * into p from public.providers where id = p_provider;
  if p.id is null or p.status <> 'active' then raise exception 'perfil inválido'; end if;
  if auth.uid() is null or not public.can_view_condo(p.condo_id) then raise exception 'sem permissão'; end if;
  if p.owner_id = auth.uid() then raise exception 'already_owner'; end if;
  if p.owner_id is not null then raise exception 'already_owned'; end if;
  if exists (select 1 from public.profile_claims where provider_id = p_provider and user_id = auth.uid() and status = 'pending') then
    raise exception 'already_pending';
  end if;
  if (select count(*) from public.profile_claims where user_id = auth.uid() and status = 'pending') >= 3 then
    raise exception 'too_many';
  end if;
  insert into public.profile_claims (condo_id, provider_id, user_id, note)
  values (p.condo_id, p_provider, auth.uid(), nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.request_profile_claim(uuid, text) to authenticated;

-- Listagem: traz o nome do condomínio de origem do prestador.
drop view if exists public.provider_listing;
create view public.provider_listing with (security_invoker = true) as
select p.*, c.slug as category_slug, c.name as category_name, c.icon as category_icon,
       coalesce(avg(r.rating) filter (where r.status = 'visible'), 0)::numeric(3,2) as avg_rating,
       count(distinct r.id) filter (where r.status = 'visible')::int as review_count,
       (select array_agg(x.category_id order by (x.category_id = p.category_id) desc, x.category_id)
          from public.provider_categories x where x.provider_id = p.id) as category_ids,
       (select array_agg(c2.slug order by (c2.id = p.category_id) desc, c2.sort)
          from public.provider_categories x join public.categories c2 on c2.id = x.category_id where x.provider_id = p.id) as category_slugs,
       (select array_agg(c2.name order by (c2.id = p.category_id) desc, c2.sort)
          from public.provider_categories x join public.categories c2 on c2.id = x.category_id where x.provider_id = p.id) as category_names,
       public.plan_is_active(p.id) as plan_active,
       (select k.name from public.condominiums k where k.id = p.condo_id) as condo_name,
       public.provider_self_pending(p.id) as self_pending,
       (select array_agg(sp.id order by sp.sort, sp.name) from public.provider_specialties ps
          join public.specialties sp on sp.id = ps.specialty_id where ps.provider_id = p.id) as specialty_ids,
       (select array_agg(sp.slug order by sp.sort, sp.name) from public.provider_specialties ps
          join public.specialties sp on sp.id = ps.specialty_id where ps.provider_id = p.id) as specialty_slugs,
       (select array_agg(sp.name order by sp.sort, sp.name) from public.provider_specialties ps
          join public.specialties sp on sp.id = ps.specialty_id where ps.provider_id = p.id) as specialty_names
from public.providers p
join public.categories c on c.id = p.category_id
left join public.reviews r on r.provider_id = p.id
group by p.id, c.id;
grant select on public.provider_listing to authenticated;
