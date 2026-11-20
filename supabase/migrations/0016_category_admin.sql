-- Admin: gerenciar a lista de categorias (criar, editar, mover de grupo, excluir). A lista é global.
-- Idempotente.

create or replace function public.admin_save_category(p_condo uuid, p_id int, p_group_id int, p_name text, p_icon text, p_keywords text)
returns int
language plpgsql security definer set search_path = public as $$
declare v_base text; v_slug text; n int := 1; v_id int;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  p_name := trim(coalesce(p_name, ''));
  p_icon := coalesce(nullif(trim(coalesce(p_icon, '')), ''), '✨');
  p_keywords := lower(unaccent(trim(coalesce(p_keywords, ''))));
  if char_length(p_name) not between 2 and 40 then raise exception 'nome inválido'; end if;
  if char_length(p_icon) > 8 then raise exception 'ícone inválido'; end if;
  if char_length(p_keywords) > 400 then raise exception 'palavras de busca longas demais'; end if;
  if not exists (select 1 from public.category_groups where id = p_group_id) then raise exception 'grupo inválido'; end if;
  if exists (select 1 from public.categories where slug = 'outros' and id = p_id) then raise exception 'categoria protegida'; end if;
  if exists (select 1 from public.categories
              where lower(unaccent(name)) = lower(unaccent(p_name)) and id is distinct from p_id) then
    raise exception 'already_exists';
  end if;
  if p_id is null then
    v_base := public.slugify(p_name);
    if v_base = '' then raise exception 'nome inválido'; end if;
    v_slug := v_base;
    while exists (select 1 from public.categories where slug = v_slug) loop
      n := n + 1; v_slug := v_base || '-' || n;
    end loop;
    insert into public.categories (slug, name, icon, sort, keywords, group_id)
    values (v_slug, p_name, p_icon,
            coalesce((select max(sort) + 10 from public.categories where group_id = p_group_id), 10), p_keywords, p_group_id)
    returning id into v_id;
  else
    -- o slug nunca muda (links e mensagens dependem dele)
    update public.categories set name = p_name, icon = p_icon, keywords = p_keywords,
           sort = case when group_id is distinct from p_group_id
                       then coalesce((select max(sort) + 10 from public.categories where group_id = p_group_id), 10) else sort end,
           group_id = p_group_id
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'categoria não encontrada'; end if;
  end if;
  return v_id;
end $$;
grant execute on function public.admin_save_category(uuid, int, int, text, text, text) to authenticated;

-- Exclui uma categoria. Quem a usa neste condomínio passa para p_move_to (obrigatório se houver uso).
-- As especialidades dela viram texto livre nos perfis daqui. Recusa se outro condomínio também usa.
create or replace function public.admin_delete_category(p_condo uuid, p_id int, p_move_to int default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_used int; v_ids uuid[];
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  if exists (select 1 from public.categories where id = p_id and slug = 'outros') then raise exception 'categoria protegida'; end if;
  if not exists (select 1 from public.categories where id = p_id) then raise exception 'categoria não encontrada'; end if;
  if exists (select 1 from public.provider_categories where category_id = p_id and condo_id <> p_condo)
     or exists (select 1 from public.providers where category_id = p_id and condo_id <> p_condo) then
    raise exception 'in_use_elsewhere';
  end if;

  select count(distinct x.provider_id) into v_used from (
    select provider_id from public.provider_categories where category_id = p_id and condo_id = p_condo
    union select id from public.providers where category_id = p_id and condo_id = p_condo) x;
  if v_used > 0 then
    if p_move_to is null or p_move_to = p_id or not exists (select 1 from public.categories where id = p_move_to) then
      raise exception 'need_target';
    end if;
    select array_agg(provider_id) into v_ids from (
      select provider_id from public.provider_categories where category_id = p_id and condo_id = p_condo
      union select id from public.providers where category_id = p_id and condo_id = p_condo) y;
    -- especialidades da categoria que some viram texto livre (só em quem ainda não tem texto)
    update public.providers p set custom_specialty = left(s.name, 40), custom_specialty_reviewed = true
      from public.provider_specialties ps join public.specialties s on s.id = ps.specialty_id
     where s.category_id = p_id and ps.provider_id = p.id and p.custom_specialty is null;
    delete from public.provider_categories where category_id = p_id and condo_id = p_condo;
    update public.providers set category_id = p_move_to where condo_id = p_condo and category_id = p_id;
    insert into public.provider_categories (provider_id, category_id, condo_id)
    select pid, p_move_to, p_condo from unnest(v_ids) pid
    on conflict do nothing;
  end if;
  delete from public.categories where id = p_id;
end $$;
grant execute on function public.admin_delete_category(uuid, int, int) to authenticated;

create or replace function public.category_counts(p_condo uuid) returns table (category_id int, n bigint)
language sql stable security definer set search_path = public as $$
  select pc.category_id, count(*) from public.provider_categories pc
   where pc.condo_id = p_condo and public.is_admin(p_condo)
   group by pc.category_id;
$$;
grant execute on function public.category_counts(uuid) to authenticated;
