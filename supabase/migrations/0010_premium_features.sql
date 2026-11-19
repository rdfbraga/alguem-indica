-- Etapa 2 da monetização (tudo desligado até o admin ligar as chaves):
-- plano Destaque (com teste grátis), vitrine (serviços, preços, horários, fotos), respostas às avaliações e anúncios locais.

-- ───────── Chaves por condomínio ─────────
create table if not exists public.condo_features (
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  feature text not null check (feature in ('plans','showcase','replies','ads')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (condo_id, feature)
);
alter table public.condo_features enable row level security;
drop policy if exists condo_features_read on public.condo_features;
create policy condo_features_read on public.condo_features for select to authenticated using (public.is_member(condo_id));
drop policy if exists condo_features_admin_write on public.condo_features;
create policy condo_features_admin_write on public.condo_features for insert to authenticated with check (public.is_admin(condo_id));
drop policy if exists condo_features_admin_update on public.condo_features;
create policy condo_features_admin_update on public.condo_features for update to authenticated
  using (public.is_admin(condo_id)) with check (public.is_admin(condo_id));
grant select, insert, update on public.condo_features to authenticated;

create or replace function public.feature_enabled(p_condo uuid, p_feature text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.condo_features where condo_id = p_condo and feature = p_feature), false);
$$;
grant execute on function public.feature_enabled(uuid, text) to authenticated;

-- ───────── Plano Destaque ─────────
create table if not exists public.provider_plans (
  provider_id uuid primary key references public.providers(id) on delete cascade,
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  source text not null default 'manual' check (source in ('trial','manual','payment')),
  trial_used boolean not null default false,
  current_period_end timestamptz,        -- ativo enquanto for maior que agora; não precisa de rotina de expiração
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.provider_plans enable row level security;
drop policy if exists provider_plans_read on public.provider_plans;
create policy provider_plans_read on public.provider_plans for select to authenticated using (public.can_edit_provider(provider_id));
grant select on public.provider_plans to authenticated;

create or replace function public.plan_is_active(p_provider uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.provider_plans where provider_id = p_provider and current_period_end > now());
$$;
grant execute on function public.plan_is_active(uuid) to authenticated;

-- Recurso premium disponível: chave ligada e, se o plano estiver ligado, perfil com plano ativo.
create or replace function public.can_use_premium(p_provider uuid, p_feature text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.feature_enabled(p.condo_id, p_feature)
           and (not public.feature_enabled(p.condo_id, 'plans') or public.plan_is_active(p.id))
      from public.providers p where p.id = p_provider), false);
$$;
grant execute on function public.can_use_premium(uuid, text) to authenticated;

-- O próprio dono começa o teste de 30 dias (uma vez por perfil).
create or replace function public.start_trial(p_provider uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.providers; pl public.provider_plans;
begin
  select * into p from public.providers where id = p_provider;
  if p.id is null then raise exception 'perfil inválido'; end if;
  if p.owner_id is distinct from auth.uid() then raise exception 'not_owner'; end if;
  if not public.feature_enabled(p.condo_id, 'plans') then raise exception 'plans_off'; end if;
  select * into pl from public.provider_plans where provider_id = p_provider;
  if pl.provider_id is not null and pl.trial_used then raise exception 'trial_used'; end if;
  if public.plan_is_active(p_provider) then raise exception 'already_active'; end if;
  insert into public.provider_plans (provider_id, condo_id, source, trial_used, current_period_end)
  values (p_provider, p.condo_id, 'trial', true, now() + interval '30 days')
  on conflict (provider_id) do update
    set source = 'trial', trial_used = true, current_period_end = now() + interval '30 days', updated_at = now();
end $$;
grant execute on function public.start_trial(uuid) to authenticated;

-- Admin concede (ou estende) dias de plano, e cancela.
create or replace function public.grant_plan(p_provider uuid, p_days int, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_condo uuid;
begin
  select condo_id into v_condo from public.providers where id = p_provider;
  if v_condo is null or not public.is_admin(v_condo) then raise exception 'apenas administradores'; end if;
  if p_days is null or p_days < 1 or p_days > 366 then raise exception 'dias inválidos'; end if;
  insert into public.provider_plans (provider_id, condo_id, source, current_period_end, note)
  values (p_provider, v_condo, 'manual', now() + make_interval(days => p_days), nullif(left(trim(coalesce(p_note, '')), 200), ''))
  on conflict (provider_id) do update
    set current_period_end = greatest(now(), coalesce(public.provider_plans.current_period_end, now())) + make_interval(days => p_days),
        source = case when public.provider_plans.source = 'trial' then 'manual' else public.provider_plans.source end,
        note = coalesce(nullif(left(trim(coalesce(p_note, '')), 200), ''), public.provider_plans.note),
        updated_at = now();
end $$;
grant execute on function public.grant_plan(uuid, int, text) to authenticated;

create or replace function public.cancel_plan(p_provider uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_condo uuid;
begin
  select condo_id into v_condo from public.providers where id = p_provider;
  if v_condo is null or not public.is_admin(v_condo) then raise exception 'apenas administradores'; end if;
  update public.provider_plans set current_period_end = now(), updated_at = now() where provider_id = p_provider;
end $$;
grant execute on function public.cancel_plan(uuid) to authenticated;

-- ───────── Vitrine: serviços e preços, horários, fotos ─────────
alter table public.providers add column if not exists hours_text text check (hours_text is null or char_length(hours_text) <= 300);

create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  description text check (description is null or char_length(description) <= 200),
  price_text text check (price_text is null or char_length(price_text) <= 40),   -- texto livre: "R$ 80", "a partir de R$ 50"
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists provider_services_idx on public.provider_services (provider_id, sort);
alter table public.provider_services enable row level security;
drop policy if exists provider_services_read on public.provider_services;
create policy provider_services_read on public.provider_services for select to authenticated using (public.is_member(condo_id));
grant select on public.provider_services to authenticated;

create table if not exists public.provider_photos (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  url text not null check (position('/provider-photos/' in url) > 0),
  caption text check (caption is null or char_length(caption) <= 80),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists provider_photos_idx on public.provider_photos (provider_id, sort);
alter table public.provider_photos enable row level security;
drop policy if exists provider_photos_read on public.provider_photos;
create policy provider_photos_read on public.provider_photos for select to authenticated using (public.is_member(condo_id));
grant select on public.provider_photos to authenticated;

-- Salva horários e a lista de serviços (substitui a lista inteira; até 12 itens).
create or replace function public.save_showcase(p_provider uuid, p_hours text, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_condo uuid;
begin
  if not public.can_edit_provider(p_provider) then raise exception 'sem permissão'; end if;
  if not public.can_use_premium(p_provider, 'showcase') then raise exception 'premium_required'; end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 12 then
    raise exception 'até 12 serviços';
  end if;
  select condo_id into v_condo from public.providers where id = p_provider;
  update public.providers set hours_text = nullif(trim(coalesce(p_hours, '')), '') where id = p_provider;
  delete from public.provider_services where provider_id = p_provider;
  insert into public.provider_services (provider_id, condo_id, title, description, price_text, sort)
  select p_provider, v_condo, trim(x.item->>'title'),
         nullif(trim(coalesce(x.item->>'description', '')), ''),
         nullif(trim(coalesce(x.item->>'price', '')), ''),
         (x.ord - 1)::int
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as x(item, ord);
end $$;
grant execute on function public.save_showcase(uuid, text, jsonb) to authenticated;

create or replace function public.add_provider_photo(p_provider uuid, p_url text, p_caption text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_condo uuid;
begin
  if not public.can_edit_provider(p_provider) then raise exception 'sem permissão'; end if;
  if not public.can_use_premium(p_provider, 'showcase') then raise exception 'premium_required'; end if;
  if (select count(*) from public.provider_photos where provider_id = p_provider) >= 6 then raise exception 'max_photos'; end if;
  select condo_id into v_condo from public.providers where id = p_provider;
  insert into public.provider_photos (provider_id, condo_id, url, caption, sort)
  values (p_provider, v_condo, p_url, nullif(left(trim(coalesce(p_caption, '')), 80), ''),
          coalesce((select max(sort) + 1 from public.provider_photos where provider_id = p_provider), 0));
end $$;
grant execute on function public.add_provider_photo(uuid, text, text) to authenticated;

create or replace function public.remove_provider_photo(p_photo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_provider uuid;
begin
  select provider_id into v_provider from public.provider_photos where id = p_photo;
  if v_provider is null or not public.can_edit_provider(v_provider) then raise exception 'sem permissão'; end if;
  delete from public.provider_photos where id = p_photo;
end $$;
grant execute on function public.remove_provider_photo(uuid) to authenticated;

-- ───────── Respostas públicas às avaliações ─────────
alter table public.reviews
  add column if not exists reply_text text check (reply_text is null or char_length(reply_text) between 2 and 500),
  add column if not exists reply_at timestamptz;

create or replace function public.reply_to_review(p_review uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.reviews; p public.providers;
begin
  select * into r from public.reviews where id = p_review;
  if r.id is null or r.status <> 'visible' then raise exception 'avaliação inválida'; end if;
  select * into p from public.providers where id = r.provider_id;
  if p.owner_id is distinct from auth.uid() then raise exception 'not_owner'; end if;
  if not public.can_use_premium(p.id, 'replies') then raise exception 'premium_required'; end if;
  update public.reviews set reply_text = trim(p_text), reply_at = now() where id = p_review;
end $$;
grant execute on function public.reply_to_review(uuid, text) to authenticated;

create or replace function public.delete_review_reply(p_review uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.reviews; p public.providers;
begin
  select * into r from public.reviews where id = p_review;
  if r.id is null then raise exception 'avaliação inválida'; end if;
  select * into p from public.providers where id = r.provider_id;
  if not (p.owner_id = auth.uid() or public.is_admin(p.condo_id)) then raise exception 'sem permissão'; end if;
  update public.reviews set reply_text = null, reply_at = null where id = p_review;
end $$;
grant execute on function public.delete_review_reply(uuid) to authenticated;

-- ───────── Anunciantes locais (home) ─────────
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  advertiser text not null check (char_length(advertiser) between 2 and 60),
  title text not null check (char_length(title) between 2 and 60),
  body text check (body is null or char_length(body) <= 140),
  image_url text check (image_url is null or position('/ad-images/' in image_url) > 0),
  link_url text check (link_url is null or (char_length(link_url) between 10 and 300 and link_url ~* '^https?://[^[:space:]]+$')),
  whatsapp text check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  cta_label text not null default 'Saiba mais' check (char_length(cta_label) between 2 and 24),
  starts_on date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (link_url is not null or whatsapp is not null),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists ads_condo_idx on public.ads (condo_id, active);
alter table public.ads enable row level security;
drop policy if exists ads_read on public.ads;
create policy ads_read on public.ads for select to authenticated using (
  public.is_member(condo_id) and (
    public.is_admin(condo_id) or (
      active
      and (starts_on is null or starts_on <= (now() at time zone 'America/Sao_Paulo')::date)
      and (ends_on is null or ends_on >= (now() at time zone 'America/Sao_Paulo')::date))));
drop policy if exists ads_admin_insert on public.ads;
create policy ads_admin_insert on public.ads for insert to authenticated with check (public.is_admin(condo_id));
drop policy if exists ads_admin_update on public.ads;
create policy ads_admin_update on public.ads for update to authenticated using (public.is_admin(condo_id)) with check (public.is_admin(condo_id));
drop policy if exists ads_admin_delete on public.ads;
create policy ads_admin_delete on public.ads for delete to authenticated using (public.is_admin(condo_id));
grant select, insert, update, delete on public.ads to authenticated;

create table if not exists public.ad_events (
  id bigint generated always as identity primary key,
  ad_id uuid not null references public.ads(id) on delete cascade,
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('view','click')),
  created_at timestamptz not null default now()
);
create index if not exists ad_events_ad_idx on public.ad_events (ad_id, created_at desc);
alter table public.ad_events enable row level security;
revoke all on public.ad_events from anon, authenticated;

create or replace function public.log_ad_event(p_ad uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads; v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_kind not in ('view','click') or auth.uid() is null then return; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is null or not a.active or not public.is_member(a.condo_id) or not public.feature_enabled(a.condo_id, 'ads') then return; end if;
  if (a.starts_on is not null and a.starts_on > v_today) or (a.ends_on is not null and a.ends_on < v_today) then return; end if;
  if public.is_admin(a.condo_id) then return; end if;   -- o admin testando não entra na conta do anunciante
  if exists (select 1 from public.ad_events where ad_id = p_ad and user_id = auth.uid() and kind = p_kind
              and created_at > now() - (case when p_kind = 'view' then interval '6 hours' else interval '1 minute' end)) then return; end if;
  insert into public.ad_events (ad_id, condo_id, user_id, kind) values (p_ad, a.condo_id, auth.uid(), p_kind);
end $$;
grant execute on function public.log_ad_event(uuid, text) to authenticated;

-- Relatório por anúncio (só admin): quantas vezes apareceu, para quantas pessoas, e quantos cliques.
create or replace function public.ad_stats(p_condo uuid, p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := (((now() at time zone 'America/Sao_Paulo')::date - (least(greatest(coalesce(p_days, 30), 1), 90) - 1))::timestamp at time zone 'America/Sao_Paulo');
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'advertiser', a.advertiser, 'title', a.title,
             'views', coalesce(s.views, 0), 'viewers', coalesce(s.viewers, 0), 'clicks', coalesce(s.clicks, 0)) order by a.created_at desc)
      from public.ads a
      left join (select ad_id,
                        count(*) filter (where kind = 'view') as views,
                        count(distinct user_id) filter (where kind = 'view') as viewers,
                        count(*) filter (where kind = 'click') as clicks
                   from public.ad_events where created_at >= v_from group by ad_id) s on s.ad_id = a.id
     where a.condo_id = p_condo), '[]'::jsonb);
end $$;
grant execute on function public.ad_stats(uuid, int) to authenticated;

-- Imagens dos anúncios: só administradores enviam.
insert into storage.buckets (id, name, public) values ('ad-images', 'ad-images', true) on conflict (id) do nothing;
drop policy if exists ad_images_upload on storage.objects;
create policy ad_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-images' and exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'admin'));

-- A listagem passa a dizer se o plano está ativo (via função, para qualquer morador ler).
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
       public.plan_is_active(p.id) as plan_active
from public.providers p
join public.categories c on c.id = p.category_id
left join public.reviews r on r.provider_id = p.id
group by p.id, c.id;
grant select on public.provider_listing to authenticated;
