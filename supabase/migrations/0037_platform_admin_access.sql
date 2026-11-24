-- O administrador da PLATAFORMA tem acesso de administração a todos os condomínios, mesmo sem ser administrador (ou morador) deles.
-- Depende da 0024 e da 0036. Idempotente.

create or replace function public.is_admin(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and condo_id = c and role = 'admin')
      or public.is_platform_admin();
$$;

create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and condo_id = c and role in ('resident','admin'))
      or public.is_platform_admin();
$$;

create or replace function public.can_view_condo(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or exists (select 1 from public.members m
                where m.user_id = auth.uid() and m.role in ('resident','admin') and m.condo_id = any (public.condo_region_ids(c))));
$$;
