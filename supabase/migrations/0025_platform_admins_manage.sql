-- Gestão de administradores de cada condomínio (só o administrador da plataforma). Depende da 0024. Idempotente.

create or replace function public.platform_condo_admins(p_condo uuid)
returns table (user_id uuid, full_name text, block text, unit text, email text)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.full_name, m.block, m.unit, u.email::text
    from public.members m join auth.users u on u.id = m.user_id
   where public.is_platform_admin() and m.condo_id = p_condo and m.role = 'admin'
   order by m.full_name;
$$;
grant execute on function public.platform_condo_admins(uuid) to authenticated;

-- Procura moradores (que ainda não são administradores) pelo nome ou e-mail.
create or replace function public.platform_find_members(p_condo uuid, p_q text)
returns table (user_id uuid, full_name text, block text, unit text, email text)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.full_name, m.block, m.unit, u.email::text
    from public.members m join auth.users u on u.id = m.user_id
   where public.is_platform_admin() and m.condo_id = p_condo and m.role <> 'admin'
     and char_length(trim(coalesce(p_q, ''))) >= 2
     and (lower(unaccent(m.full_name)) like '%' || lower(unaccent(replace(replace(trim(p_q), '%', ''), '_', ''))) || '%'
          or lower(u.email) like '%' || lower(replace(replace(trim(p_q), '%', ''), '_', '')) || '%')
   order by m.full_name limit 8;
$$;
grant execute on function public.platform_find_members(uuid, text) to authenticated;

-- Promove ou rebaixa um morador do condomínio. Nunca deixa o condomínio sem administrador.
create or replace function public.platform_set_admin(p_condo uuid, p_user uuid, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  if not exists (select 1 from public.members where condo_id = p_condo and user_id = p_user) then raise exception 'nao_e_morador'; end if;
  if not p_admin then
    if (select count(*) from public.members where condo_id = p_condo and role = 'admin') <= 1
       and exists (select 1 from public.members where condo_id = p_condo and user_id = p_user and role = 'admin') then
      raise exception 'ultimo_admin';
    end if;
  end if;
  update public.members set role = case when p_admin then 'admin' else 'resident' end where condo_id = p_condo and user_id = p_user;
end $$;
grant execute on function public.platform_set_admin(uuid, uuid, boolean) to authenticated;

-- Adiciona como administrador uma pessoa que já tem conta no app (mesmo que ainda não seja moradora deste condomínio).
create or replace function public.platform_add_admin_by_email(p_condo uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_full text;
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  if not exists (select 1 from public.condominiums where id = p_condo) then raise exception 'condominio_nao_encontrado'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(coalesce(p_email, '')));
  if v_user is null then raise exception 'usuario_nao_encontrado'; end if;
  select full_name into v_full from public.members where user_id = v_user order by created_at limit 1;
  insert into public.members (user_id, condo_id, full_name, block, unit, role)
  values (v_user, p_condo, coalesce(v_full, split_part(trim(p_email), '@', 1)), 'Adm', '0', 'admin')
  on conflict (user_id, condo_id) do update set role = 'admin';
end $$;
grant execute on function public.platform_add_admin_by_email(uuid, text) to authenticated;
