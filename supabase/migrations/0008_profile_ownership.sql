-- Posse de perfil: o próprio prestador pode "assumir" o perfil (com aprovação do admin).
alter table public.providers
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_since timestamptz;

create table if not exists public.profile_claims (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists profile_claims_one_pending on public.profile_claims (provider_id, user_id) where status = 'pending';
create index if not exists profile_claims_condo_status_idx on public.profile_claims (condo_id, status, created_at desc);

alter table public.profile_claims enable row level security;
drop policy if exists profile_claims_read on public.profile_claims;
create policy profile_claims_read on public.profile_claims for select to authenticated
  using (user_id = auth.uid() or public.is_admin(condo_id));
grant select on public.profile_claims to authenticated;

-- Quem edita o perfil: o dono, se houver; senão quem indicou. O admin sempre pode (moderação).
create or replace function public.can_edit_provider(p_provider uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.providers p
     where p.id = p_provider
       and (public.is_admin(p.condo_id)
            or case when p.owner_id is not null then p.owner_id = auth.uid() else p.created_by = auth.uid() end));
$$;

-- Morador pede para assumir um perfil.
create or replace function public.request_profile_claim(p_provider uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.providers; v_id uuid;
begin
  select * into p from public.providers where id = p_provider;
  if p.id is null or p.status <> 'active' then raise exception 'perfil inválido'; end if;
  if auth.uid() is null or not public.is_member(p.condo_id) then raise exception 'sem permissão'; end if;
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

-- Admin aprova ou recusa. Aprovar torna a pessoa dona e recusa os outros pedidos pendentes do mesmo perfil.
create or replace function public.decide_profile_claim(p_claim uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare c public.profile_claims;
begin
  select * into c from public.profile_claims where id = p_claim for update;
  if c.id is null then raise exception 'pedido não encontrado'; end if;
  if not public.is_admin(c.condo_id) then raise exception 'apenas administradores'; end if;
  if c.status <> 'pending' then raise exception 'already_decided'; end if;
  if p_approve then
    update public.providers set owner_id = c.user_id, owner_since = now() where id = c.provider_id;
    update public.profile_claims set status = 'approved', decided_at = now() where id = c.id;
    update public.profile_claims set status = 'rejected', decided_at = now()
     where provider_id = c.provider_id and status = 'pending' and id <> c.id;
  else
    update public.profile_claims set status = 'rejected', decided_at = now() where id = c.id;
  end if;
end $$;
grant execute on function public.decide_profile_claim(uuid, boolean) to authenticated;

-- Admin remove o vínculo do dono (o perfil volta a ser editável por quem o indicou).
create or replace function public.clear_provider_owner(p_provider uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_condo uuid;
begin
  select condo_id into v_condo from public.providers where id = p_provider;
  if v_condo is null or not public.is_admin(v_condo) then raise exception 'apenas administradores'; end if;
  update public.providers set owner_id = null, owner_since = null where id = p_provider;
end $$;
grant execute on function public.clear_provider_owner(uuid) to authenticated;

-- Edição dos dados do perfil por quem pode editar (dono, ou autor enquanto não há dono, ou admin).
create or replace function public.update_provider_profile(
  p_provider uuid, p_name text, p_description text, p_whatsapp text, p_photo_url text)
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
         photo_url = v_photo
   where id = p_provider;
end $$;
grant execute on function public.update_provider_profile(uuid, text, text, text, text) to authenticated;

-- A listagem passa a trazer owner_id / owner_since (via p.*).
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
