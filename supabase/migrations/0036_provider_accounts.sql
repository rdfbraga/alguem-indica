-- Acesso de prestador que NÃO mora no condomínio: uma conta do tipo "prestador" (sem bloco/unidade) que só enxerga o próprio perfil.
-- Prestador não conta como morador nos números do admin. Depende de 0033. Idempotente.

alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('resident','admin','provider'));

-- "Morador" passa a significar morador ou administrador. Prestador com conta NÃO enxerga o condomínio (nem os outros prestadores).
create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and condo_id = c and role in ('resident','admin'));
$$;
create or replace function public.can_view_condo(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.members m
     where m.user_id = auth.uid() and m.role in ('resident','admin') and m.condo_id = any (public.condo_region_ids(c)));
$$;

-- Cria a conta de prestador no condomínio (só nome; sem bloco/unidade). Quem já é morador não muda.
create or replace function public.join_as_provider(p_condo uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem permissão'; end if;
  p_name := trim(coalesce(p_name, ''));
  if char_length(p_name) not between 2 and 80 then raise exception 'nome_invalido'; end if;
  if not exists (select 1 from public.condominiums where id = p_condo and is_active) then raise exception 'condominio_invalido'; end if;
  insert into public.members (user_id, condo_id, full_name, block, unit, role)
  values (auth.uid(), p_condo, p_name, 'Prestador', '-', 'provider')
  on conflict (user_id, condo_id) do nothing;
end $$;
grant execute on function public.join_as_provider(uuid, text) to authenticated;

-- Pré-visualização mínima para quem recebeu o link de "assumir perfil" (nome e categoria; só com login).
create or replace function public.claim_preview(p_provider uuid)
returns table (name text, category_name text, category_icon text, condo_name text, has_owner boolean)
language sql stable security definer set search_path = public as $$
  select p.name, c.name, c.icon, k.name, p.owner_id is not null
    from public.providers p join public.categories c on c.id = p.category_id join public.condominiums k on k.id = p.condo_id
   where auth.uid() is not null and p.id = p_provider and p.status = 'active' and k.is_active;
$$;
grant execute on function public.claim_preview(uuid) to authenticated;

-- ───── O que o prestador com conta enxerga: só o perfil que é dele (ou que pediu para assumir) ─────
drop policy if exists providers_read_own on public.providers;
create policy providers_read_own on public.providers for select to authenticated
  using (owner_id = auth.uid()
         or exists (select 1 from public.profile_claims c where c.provider_id = providers.id and c.user_id = auth.uid() and c.status = 'pending'));

drop policy if exists reviews_read_own on public.reviews;
create policy reviews_read_own on public.reviews for select to authenticated
  using (status = 'visible' and exists (select 1 from public.providers p where p.id = reviews.provider_id and p.owner_id = auth.uid()));

drop policy if exists provider_categories_read_own on public.provider_categories;
create policy provider_categories_read_own on public.provider_categories for select to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_categories.provider_id
                  and (p.owner_id = auth.uid() or exists (select 1 from public.profile_claims c where c.provider_id = p.id and c.user_id = auth.uid() and c.status = 'pending'))));
drop policy if exists provider_specialties_read_own on public.provider_specialties;
create policy provider_specialties_read_own on public.provider_specialties for select to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_specialties.provider_id and p.owner_id = auth.uid()));
drop policy if exists provider_services_read_own on public.provider_services;
create policy provider_services_read_own on public.provider_services for select to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_services.provider_id and p.owner_id = auth.uid()));
drop policy if exists provider_photos_read_own on public.provider_photos;
create policy provider_photos_read_own on public.provider_photos for select to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_photos.provider_id and p.owner_id = auth.uid()));

-- ───── Pedir para assumir um perfil: vale também para a conta de prestador ─────
create or replace function public.request_profile_claim(p_provider uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.providers; v_id uuid; v_auto boolean;
begin
  select * into p from public.providers where id = p_provider;
  if p.id is null or p.status <> 'active' then raise exception 'perfil inválido'; end if;
  if auth.uid() is null or not (
       public.can_view_condo(p.condo_id)
       or exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'provider'
                   and m.condo_id = any (public.condo_region_ids(p.condo_id)))) then
    raise exception 'sem permissão';
  end if;
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
  -- Período de lançamento: quem cadastra o PRÓPRIO perfil (e o perfil está sem alertas) vira dono na hora, sem esperar o admin.
  select (c.auto_approve_until is not null and c.auto_approve_until > now()) into v_auto from public.condominiums c where c.id = p.condo_id;
  if coalesce(v_auto, false) and p.created_by = auth.uid() and p.owner_id is null and not p.flagged then
    update public.providers set owner_id = auth.uid(), owner_since = now() where id = p_provider;
    update public.profile_claims set status = 'approved', decided_at = now(), auto_approved = true where id = v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.request_profile_claim(uuid, text) to authenticated;

-- ───── Prestador não conta como morador nos números do admin ─────
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
           'members', (select count(*) from public.members where role <> 'provider' and condo_id = p_condo),
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
                where role <> 'provider' and condo_id = p_condo and created_at >= v_from_ts group by 1) m on m.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from public.providers
                where condo_id = p_condo and created_at >= v_from_ts group by 1) p on p.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from public.reviews
                where condo_id = p_condo and status = 'visible' and created_at >= v_from_ts group by 1) r on r.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d,
                      count(distinct user_id) filter (where kind = 'view') viewers,
                      count(*) filter (where kind = 'whatsapp') whatsapp
                 from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and created_at >= v_from_ts group by 1) e on e.d = g.d;

  select jsonb_build_object(
    'members', (select count(*) from public.members where role <> 'provider' and condo_id = p_condo and created_at >= v_from_ts),
    'providers', (select count(*) from public.providers where condo_id = p_condo and created_at >= v_from_ts),
    'reviews', (select count(*) from public.reviews where condo_id = p_condo and status = 'visible' and created_at >= v_from_ts),
    'viewers', (select count(distinct user_id) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'view' and created_at >= v_from_ts),
    'views', (select count(*) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'view' and created_at >= v_from_ts),
    'whatsapp', (select count(*) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'whatsapp' and created_at >= v_from_ts))
    into tot;
  select jsonb_build_object(
    'members', (select count(*) from public.members where role <> 'provider' and condo_id = p_condo and created_at >= v_prev_ts and created_at < v_from_ts),
    'providers', (select count(*) from public.providers where condo_id = p_condo and created_at >= v_prev_ts and created_at < v_from_ts),
    'reviews', (select count(*) from public.reviews where condo_id = p_condo and status = 'visible' and created_at >= v_prev_ts and created_at < v_from_ts),
    'viewers', (select count(distinct user_id) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'view' and created_at >= v_prev_ts and created_at < v_from_ts),
    'views', (select count(*) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'view' and created_at >= v_prev_ts and created_at < v_from_ts),
    'whatsapp', (select count(*) from public.provider_events where coalesce(viewer_condo_id, condo_id) = p_condo and kind = 'whatsapp' and created_at >= v_prev_ts and created_at < v_from_ts))
    into prev;

  select jsonb_build_object(
    'members', (select count(*) from public.members where role <> 'provider' and condo_id = p_condo),
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
    from (select block, count(*) n from public.members where role <> 'provider' and condo_id = p_condo group by block order by count(*) desc, block limit 10) b;

  return jsonb_build_object('days', v_days, 'series', series, 'totals', tot, 'prev', prev, 'snapshot', snap,
                            'engagement', eng, 'categories', cats, 'gaps', gaps, 'blocks', blocks);
end $$;
grant execute on function public.growth_stats(uuid, int) to authenticated;

drop function if exists public.admin_overview();
create or replace function public.admin_overview()
returns table (
  condo_id uuid, slug text, name text, region_name text,
  members bigint, members_new bigint, providers bigint, reviews_new bigint, whatsapp_30d bigint, active_7d bigint,
  pend_feedback bigint, pend_claims bigint, pend_flagged bigint, pend_reports bigint, pend_categories bigint, pend_specialties bigint, kind text)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, r.name,
    (select count(*) from public.members m where m.role <> 'provider' and m.condo_id = c.id),
    (select count(*) from public.members m where m.role <> 'provider' and m.condo_id = c.id and m.created_at > now() - interval '30 days'),
    (select count(*) from public.providers p where p.condo_id = c.id and p.status = 'active'),
    (select count(*) from public.reviews v where v.condo_id = c.id and v.status = 'visible' and v.created_at > now() - interval '30 days'),
    (select count(*) from public.provider_events e where coalesce(e.viewer_condo_id, e.condo_id) = c.id and e.kind = 'whatsapp' and e.created_at > now() - interval '30 days'),
    (select count(distinct e.user_id) from public.provider_events e where coalesce(e.viewer_condo_id, e.condo_id) = c.id and e.created_at > now() - interval '7 days'),
    (select count(*) from public.feedback f where f.condo_id = c.id and f.status = 'new'),
    (select count(*) from public.profile_claims pc where pc.condo_id = c.id and pc.status = 'pending'),
    (select count(*) from public.providers p where p.condo_id = c.id and p.flagged),
    (select count(*) from public.reports rp where rp.condo_id = c.id and rp.status = 'open'),
    (select count(*) from public.providers p where p.condo_id = c.id and p.custom_category is not null and not p.custom_category_reviewed),
    (select count(*) from public.providers p where p.condo_id = c.id and p.custom_specialty is not null and not p.custom_specialty_reviewed),
    c.kind
  from public.condominiums c
  left join public.regions r on r.id = c.region_id
  where auth.uid() is not null and public.is_admin(c.id)
  order by c.name;
$$;
grant execute on function public.admin_overview() to authenticated;

drop function if exists public.platform_condos();
create or replace function public.platform_condos()
returns table (id uuid, slug text, name text, is_active boolean, region_id uuid, region_name text,
               members bigint, providers bigint, admins bigint, created_at timestamptz, auto_approve_until timestamptz, kind text)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.is_active, c.region_id, r.name,
         (select count(*) from public.members m where m.role <> 'provider' and m.condo_id = c.id),
         (select count(*) from public.providers p where p.condo_id = c.id),
         (select count(*) from public.members m where m.role <> 'provider' and m.condo_id = c.id and m.role = 'admin'),
         c.created_at, c.auto_approve_until, c.kind
    from public.condominiums c left join public.regions r on r.id = c.region_id
   where public.is_platform_admin()
   order by c.name;
$$;
grant execute on function public.platform_condos() to authenticated;

create or replace function public.platform_find_members(p_condo uuid, p_q text)
returns table (user_id uuid, full_name text, block text, unit text, email text)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.full_name, m.block, m.unit, u.email::text
    from public.members m join auth.users u on u.id = m.user_id
   where public.is_platform_admin() and m.condo_id = p_condo and m.role = 'resident'
     and char_length(trim(coalesce(p_q, ''))) >= 2
     and (lower(unaccent(m.full_name)) like '%' || lower(unaccent(replace(replace(trim(p_q), '%', ''), '_', ''))) || '%'
          or lower(u.email) like '%' || lower(replace(replace(trim(p_q), '%', ''), '_', '')) || '%')
   order by m.full_name limit 8;
$$;
grant execute on function public.platform_find_members(uuid, text) to authenticated;
