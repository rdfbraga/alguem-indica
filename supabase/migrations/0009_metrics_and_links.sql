-- Etapa 1 da monetização: Instagram e site no perfil (grátis) + medição de visitas e cliques.

-- ───────── Instagram e site ─────────
alter table public.providers
  add column if not exists instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column if not exists website text check (website is null or website ~* '^https?://[^[:space:]]{3,200}$');

-- ───────── Eventos de medição ─────────
create table if not exists public.provider_events (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers(id) on delete cascade,
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,   -- só para contar pessoas únicas; nunca é mostrado
  kind text not null check (kind in ('view','whatsapp','instagram','website')),
  created_at timestamptz not null default now()
);
create index if not exists provider_events_provider_idx on public.provider_events (provider_id, created_at desc);
create index if not exists provider_events_condo_idx on public.provider_events (condo_id, created_at desc);
alter table public.provider_events enable row level security;   -- sem policies: só as funções abaixo leem/escrevem
revoke all on public.provider_events from anon, authenticated;

-- Registra uma visita ou clique. Silenciosa (nunca quebra a tela). Não conta o próprio dono; evita repetição.
create or replace function public.log_provider_event(p_provider uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public as $$
declare p public.providers;
begin
  if p_kind not in ('view','whatsapp','instagram','website') or auth.uid() is null then return; end if;
  select * into p from public.providers where id = p_provider;
  if p.id is null or p.status <> 'active' or not public.is_member(p.condo_id) then return; end if;
  if p.owner_id = auth.uid() then return; end if;
  if exists (select 1 from public.provider_events
              where provider_id = p_provider and user_id = auth.uid() and kind = p_kind
                and created_at > now() - (case when p_kind = 'view' then interval '30 minutes' else interval '1 minute' end)) then
    return;
  end if;
  insert into public.provider_events (provider_id, condo_id, user_id, kind) values (p_provider, p.condo_id, auth.uid(), p_kind);
end $$;
grant execute on function public.log_provider_event(uuid, text) to authenticated;

-- Resultados de um perfil nos últimos N dias (7, 30 ou 90), com o período anterior para comparação.
-- Só o dono do perfil e o admin do condomínio podem ver.
create or replace function public.provider_stats(p_provider uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_condo uuid; v_owner uuid;
  v_days int := least(greatest(coalesce(p_days, 30), 1), 90);
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_from date; v_from_ts timestamptz; v_prev_ts timestamptz;
  series jsonb; totals jsonb; prev jsonb; rv jsonb;
begin
  select condo_id, owner_id into v_condo, v_owner from public.providers where id = p_provider;
  if v_condo is null then raise exception 'perfil inválido'; end if;
  if not (v_owner = auth.uid() or public.is_admin(v_condo)) then raise exception 'sem permissão'; end if;
  v_from := v_today - (v_days - 1);
  v_from_ts := (v_from::timestamp at time zone 'America/Sao_Paulo');
  v_prev_ts := ((v_from - v_days)::timestamp at time zone 'America/Sao_Paulo');

  select coalesce(jsonb_agg(jsonb_build_object(
           'd', to_char(g.d, 'YYYY-MM-DD'),
           'views', coalesce(a.views, 0), 'viewers', coalesce(a.viewers, 0),
           'whatsapp', coalesce(a.whatsapp, 0), 'instagram', coalesce(a.instagram, 0), 'website', coalesce(a.website, 0))
           order by g.d), '[]'::jsonb)
    into series
    from (select generate_series(v_from, v_today, interval '1 day')::date as d) g
    left join (
      select (created_at at time zone 'America/Sao_Paulo')::date as d,
             count(*) filter (where kind = 'view') as views,
             count(distinct user_id) filter (where kind = 'view') as viewers,
             count(*) filter (where kind = 'whatsapp') as whatsapp,
             count(*) filter (where kind = 'instagram') as instagram,
             count(*) filter (where kind = 'website') as website
        from public.provider_events
       where provider_id = p_provider and created_at >= v_from_ts
       group by 1) a on a.d = g.d;

  select jsonb_build_object(
           'views', count(*) filter (where kind = 'view'),
           'viewers', count(distinct user_id) filter (where kind = 'view'),
           'whatsapp', count(*) filter (where kind = 'whatsapp'),
           'instagram', count(*) filter (where kind = 'instagram'),
           'website', count(*) filter (where kind = 'website'))
    into totals from public.provider_events where provider_id = p_provider and created_at >= v_from_ts;

  select jsonb_build_object(
           'views', count(*) filter (where kind = 'view'),
           'viewers', count(distinct user_id) filter (where kind = 'view'),
           'whatsapp', count(*) filter (where kind = 'whatsapp'),
           'instagram', count(*) filter (where kind = 'instagram'),
           'website', count(*) filter (where kind = 'website'))
    into prev from public.provider_events where provider_id = p_provider and created_at >= v_prev_ts and created_at < v_from_ts;

  select jsonb_build_object(
           'reviews_new', count(*) filter (where created_at >= v_from_ts),
           'reviews_total', count(*),
           'reviews_avg', round(avg(rating)::numeric, 2))
    into rv from public.reviews where provider_id = p_provider and status = 'visible';

  return jsonb_build_object('days', v_days, 'series', series, 'totals', totals, 'prev', prev) || rv;
end $$;
grant execute on function public.provider_stats(uuid, int) to authenticated;

-- Visão geral do condomínio (só admin): totais e os 5 perfis com mais cliques no WhatsApp.
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
    into totals from public.provider_events where condo_id = p_condo and created_at >= v_from_ts;
  select coalesce(jsonb_agg(t order by (t->>'whatsapp')::int desc, (t->>'views')::int desc), '[]'::jsonb) into top
    from (select jsonb_build_object('id', e.provider_id, 'name', p.name,
                  'whatsapp', count(*) filter (where e.kind = 'whatsapp'),
                  'views', count(*) filter (where e.kind = 'view')) as t
            from public.provider_events e join public.providers p on p.id = e.provider_id
           where e.condo_id = p_condo and e.created_at >= v_from_ts
           group by e.provider_id, p.name
           order by count(*) filter (where e.kind = 'whatsapp') desc, count(*) filter (where e.kind = 'view') desc
           limit 5) x;
  return jsonb_build_object('days', v_days, 'totals', totals, 'top', top);
end $$;
grant execute on function public.condo_stats(uuid, int) to authenticated;

-- Edição do perfil agora inclui Instagram e site.
drop function if exists public.update_provider_profile(uuid, text, text, text, text);
create or replace function public.update_provider_profile(
  p_provider uuid, p_name text, p_description text, p_whatsapp text, p_photo_url text,
  p_instagram text default null, p_website text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_photo text := nullif(trim(coalesce(p_photo_url, '')), '');
begin
  if not public.can_edit_provider(p_provider) then raise exception 'sem permissão'; end if;
  if v_photo is not null and position('/provider-photos/' in v_photo) = 0 then raise exception 'foto inválida'; end if;
  update public.providers
     set name = trim(p_name),
         description = trim(coalesce(p_description, '')),
         whatsapp = p_whatsapp,
         photo_url = v_photo,
         instagram = nullif(trim(coalesce(p_instagram, '')), ''),
         website = nullif(trim(coalesce(p_website, '')), '')
   where id = p_provider;
end $$;
grant execute on function public.update_provider_profile(uuid, text, text, text, text, text, text) to authenticated;

-- A listagem passa a trazer instagram e website (via p.*).
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
          from public.provider_categories x join public.categories c2 on c2.id = x.category_id where x.provider_id = p.id) as category_names
from public.providers p
join public.categories c on c.id = p.category_id
left join public.reviews r on r.provider_id = p.id
group by p.id, c.id;
grant select on public.provider_listing to authenticated;
