-- Tipo de condomínio: prédios (bloco e apartamento) ou casas (rua e número). O tipo muda os rótulos do cadastro e o que aparece
-- nas avaliações. Os condomínios que já existem ficam como "prédios". Idempotente.

alter table public.condominiums add column if not exists kind text not null default 'building' check (kind in ('building','houses'));

-- O "bloco" passa a poder ter o nome de uma rua (até 60 letras).
alter table public.members drop constraint if exists members_block_check;
alter table public.members drop constraint if exists members_block_len;
alter table public.members add constraint members_block_len check (char_length(block) between 1 and 60);

-- O app lê o tipo junto com o condomínio.
drop function if exists public.condo_by_slug(text);
create or replace function public.condo_by_slug(s text) returns table (id uuid, slug text, name text, kind text)
language sql stable security definer set search_path = public as $$
  select id, slug, name, kind from public.condominiums where slug = s and is_active;
$$;
grant execute on function public.condo_by_slug(text) to anon, authenticated;

drop function if exists public.platform_create_condo(text, text, uuid);
create or replace function public.platform_create_condo(p_slug text, p_name text, p_region uuid default null, p_kind text default 'building') returns uuid
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
  if coalesce(p_kind, 'building') not in ('building','houses') then raise exception 'tipo_invalido'; end if;
  insert into public.condominiums (slug, name, region_id, kind) values (p_slug, p_name, p_region, coalesce(p_kind, 'building')) returning id into v_id;
  -- quem cria já entra como administrador (aproveita o nome de outro cadastro dela)
  select full_name into v_full from public.members where user_id = auth.uid() order by created_at limit 1;
  insert into public.members (user_id, condo_id, full_name, block, unit, role)
  values (auth.uid(), v_id, coalesce(v_full, 'Administração'), 'Adm', '0', 'admin')
  on conflict (user_id, condo_id) do update set role = 'admin';
  return v_id;
end $$;
grant execute on function public.platform_create_condo(text, text, uuid, text) to authenticated;

drop function if exists public.platform_update_condo(uuid, text, uuid, boolean);
create or replace function public.platform_update_condo(p_condo uuid, p_name text, p_region uuid, p_active boolean, p_kind text default null) returns void
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
  if p_kind is not null and p_kind not in ('building','houses') then raise exception 'tipo_invalido'; end if;
  update public.condominiums set name = p_name, region_id = p_region, is_active = coalesce(p_active, is_active), kind = coalesce(p_kind, kind) where id = p_condo;
end $$;
grant execute on function public.platform_update_condo(uuid, text, uuid, boolean, text) to authenticated;

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
    -- prédios: "Maria S. · Bloco B"; casas: "Maria S. · Rua das Acácias" (a rua como foi digitada, nunca o número)
    new.author_label := short || ' · ' || case when (select kind from public.condominiums where id = m.condo_id) = 'houses' then m.block else 'Bloco ' || m.block end;
    new.author_origin := null;
  else
    select name into v_condo_name from public.condominiums where id = m.condo_id;
    new.author_label := short || ' · ' || v_condo_name;   -- nunca guarda o bloco de quem é de outro condomínio
    new.author_origin := v_condo_name;
  end if;
  return new;
end $$;

drop function if exists public.admin_overview();
create or replace function public.admin_overview()
returns table (
  condo_id uuid, slug text, name text, region_name text,
  members bigint, members_new bigint, providers bigint, reviews_new bigint, whatsapp_30d bigint, active_7d bigint,
  pend_feedback bigint, pend_claims bigint, pend_flagged bigint, pend_reports bigint, pend_categories bigint, pend_specialties bigint, kind text)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, r.name,
    (select count(*) from public.members m where m.condo_id = c.id),
    (select count(*) from public.members m where m.condo_id = c.id and m.created_at > now() - interval '30 days'),
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
         (select count(*) from public.members m where m.condo_id = c.id),
         (select count(*) from public.providers p where p.condo_id = c.id),
         (select count(*) from public.members m where m.condo_id = c.id and m.role = 'admin'),
         c.created_at, c.auto_approve_until, c.kind
    from public.condominiums c left join public.regions r on r.id = c.region_id
   where public.is_platform_admin()
   order by c.name;
$$;
grant execute on function public.platform_condos() to authenticated;
