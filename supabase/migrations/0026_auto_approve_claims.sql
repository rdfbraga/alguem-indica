-- Aprovação automática dos perfis cadastrados pelo próprio, durante um período de lançamento do condomínio.
-- Por padrão: 7 dias a partir de agora para os condomínios que já existem, e 7 dias a partir da criação para os novos.
-- Só vale para quem cadastra o PRÓPRIO perfil; pedidos para assumir o perfil de outra pessoa continuam com o admin, assim como
-- perfis com alerta de duplicidade ou conteúdo suspeito. Idempotente (rodar de novo não reinicia o prazo).

alter table public.condominiums add column if not exists auto_approve_until timestamptz default (now() + interval '7 days');
alter table public.profile_claims add column if not exists auto_approved boolean not null default false;

create or replace function public.request_profile_claim(p_provider uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.providers; v_id uuid; v_auto boolean;
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
  -- Período de lançamento: quem cadastra o PRÓPRIO perfil (e o perfil está sem alertas) vira dono na hora, sem esperar o admin.
  select (c.auto_approve_until is not null and c.auto_approve_until > now()) into v_auto from public.condominiums c where c.id = p.condo_id;
  if coalesce(v_auto, false) and p.created_by = auth.uid() and p.owner_id is null and not p.flagged then
    update public.providers set owner_id = auth.uid(), owner_since = now() where id = p_provider;
    update public.profile_claims set status = 'approved', decided_at = now(), auto_approved = true where id = v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.request_profile_claim(uuid, text) to authenticated;

-- Liga (com data-limite) ou desliga (null) a aprovação automática de um condomínio. Só o administrador da plataforma.
create or replace function public.platform_set_auto_approve(p_condo uuid, p_until timestamptz) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  update public.condominiums set auto_approve_until = p_until where id = p_condo;
  if not found then raise exception 'condominio_nao_encontrado'; end if;
end $$;
grant execute on function public.platform_set_auto_approve(uuid, timestamptz) to authenticated;

-- A tela do admin do condomínio mostra se a aprovação automática está ligada.
create or replace function public.condo_auto_approve(p_condo uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when public.is_admin(p_condo) and auto_approve_until > now() then auto_approve_until end
    from public.condominiums where id = p_condo;
$$;
grant execute on function public.condo_auto_approve(uuid) to authenticated;

-- A lista da plataforma passa a trazer o prazo da aprovação automática.
drop function if exists public.platform_condos();
create or replace function public.platform_condos()
returns table (id uuid, slug text, name text, is_active boolean, region_id uuid, region_name text,
               members bigint, providers bigint, admins bigint, created_at timestamptz, auto_approve_until timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.is_active, c.region_id, r.name,
         (select count(*) from public.members m where m.condo_id = c.id),
         (select count(*) from public.providers p where p.condo_id = c.id),
         (select count(*) from public.members m where m.condo_id = c.id and m.role = 'admin'),
         c.created_at, c.auto_approve_until
    from public.condominiums c left join public.regions r on r.id = c.region_id
   where public.is_platform_admin()
   order by c.name;
$$;
grant execute on function public.platform_condos() to authenticated;
