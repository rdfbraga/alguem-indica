-- Administrador da PLATAFORMA: quem cria condomínios e regiões (acima do administrador de cada condomínio).
-- Defina quem é com supabase/tools/definir_admin_plataforma.sql. Idempotente.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;   -- sem policies: só as funções abaixo
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- is_admin: a pessoa é a administradora da plataforma? has_any: já existe alguma? (para a tela orientar a configuração)
create or replace function public.platform_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('is_admin', public.is_platform_admin(), 'has_any', exists (select 1 from public.platform_admins));
$$;
grant execute on function public.platform_status() to authenticated;

create or replace function public.platform_condos()
returns table (id uuid, slug text, name text, is_active boolean, region_id uuid, region_name text,
               members bigint, providers bigint, admins bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.is_active, c.region_id, r.name,
         (select count(*) from public.members m where m.condo_id = c.id),
         (select count(*) from public.providers p where p.condo_id = c.id),
         (select count(*) from public.members m where m.condo_id = c.id and m.role = 'admin'),
         c.created_at
    from public.condominiums c left join public.regions r on r.id = c.region_id
   where public.is_platform_admin()
   order by c.name;
$$;
grant execute on function public.platform_condos() to authenticated;

create or replace function public.platform_regions()
returns table (id uuid, slug text, name text, condos bigint)
language sql stable security definer set search_path = public as $$
  select r.id, r.slug, r.name, (select count(*) from public.condominiums c where c.region_id = r.id)
    from public.regions r where public.is_platform_admin() order by r.name;
$$;
grant execute on function public.platform_regions() to authenticated;

-- Perfis que teriam o mesmo WhatsApp se o condomínio entrasse na região.
create or replace function public.platform_region_conflicts(p_condo uuid, p_region uuid)
returns table (whatsapp text, name_here text, name_there text, condo_there text)
language sql stable security definer set search_path = public as $$
  select a.whatsapp, a.name, b.name, c.name
    from public.providers a
    join public.providers b on b.whatsapp = a.whatsapp and b.condo_id <> a.condo_id
    join public.condominiums c on c.id = b.condo_id and c.region_id = p_region
   where public.is_platform_admin() and a.condo_id = p_condo
   order by a.name;
$$;
grant execute on function public.platform_region_conflicts(uuid, uuid) to authenticated;

create or replace function public.platform_create_condo(p_slug text, p_name text, p_region uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_full text;
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  p_slug := lower(trim(coalesce(p_slug, '')));
  p_name := trim(coalesce(p_name, ''));
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) not between 3 and 40 then raise exception 'slug_invalido'; end if;
  if char_length(p_name) not between 2 and 80 then raise exception 'nome_invalido'; end if;
  if exists (select 1 from public.condominiums where slug = p_slug) then raise exception 'slug_em_uso'; end if;
  if p_region is not null and not exists (select 1 from public.regions where id = p_region) then raise exception 'regiao_invalida'; end if;
  insert into public.condominiums (slug, name, region_id) values (p_slug, p_name, p_region) returning id into v_id;
  -- quem cria já entra como administrador (aproveita o nome de outro cadastro dela)
  select full_name into v_full from public.members where user_id = auth.uid() order by created_at limit 1;
  insert into public.members (user_id, condo_id, full_name, block, unit, role)
  values (auth.uid(), v_id, coalesce(v_full, 'Administração'), 'Adm', '0', 'admin')
  on conflict (user_id, condo_id) do update set role = 'admin';
  return v_id;
end $$;
grant execute on function public.platform_create_condo(text, text, uuid) to authenticated;

-- Edita nome, região e se está ativo. O endereço (slug) nunca muda. Entrar numa região com WhatsApp repetido é recusado.
create or replace function public.platform_update_condo(p_condo uuid, p_name text, p_region uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_current uuid;
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  p_name := trim(coalesce(p_name, ''));
  if char_length(p_name) not between 2 and 80 then raise exception 'nome_invalido'; end if;
  select region_id into v_current from public.condominiums where id = p_condo;
  if not found then raise exception 'condominio_nao_encontrado'; end if;
  if p_region is not null and not exists (select 1 from public.regions where id = p_region) then raise exception 'regiao_invalida'; end if;
  if p_region is not null and p_region is distinct from v_current
     and exists (select 1 from public.platform_region_conflicts(p_condo, p_region)) then
    raise exception 'whatsapp_conflict';
  end if;
  update public.condominiums set name = p_name, region_id = p_region, is_active = coalesce(p_active, is_active) where id = p_condo;
end $$;
grant execute on function public.platform_update_condo(uuid, text, uuid, boolean) to authenticated;

create or replace function public.platform_save_region(p_id uuid, p_slug text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  p_name := trim(coalesce(p_name, ''));
  if char_length(p_name) not between 2 and 80 then raise exception 'nome_invalido'; end if;
  if p_id is null then
    p_slug := lower(trim(coalesce(p_slug, '')));
    if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) not between 3 and 40 then raise exception 'slug_invalido'; end if;
    if exists (select 1 from public.regions where slug = p_slug) then raise exception 'slug_em_uso'; end if;
    insert into public.regions (slug, name) values (p_slug, p_name) returning id into v_id;
  else
    update public.regions set name = p_name where id = p_id returning id into v_id;
    if v_id is null then raise exception 'regiao_invalida'; end if;
  end if;
  return v_id;
end $$;
grant execute on function public.platform_save_region(uuid, text, text) to authenticated;

create or replace function public.platform_delete_region(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  if exists (select 1 from public.condominiums where region_id = p_id) then raise exception 'region_not_empty'; end if;
  delete from public.regions where id = p_id;
end $$;
grant execute on function public.platform_delete_region(uuid) to authenticated;
