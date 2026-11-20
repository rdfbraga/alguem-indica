-- Painel do Admin para as especialidades: fila do que os moradores escrevem em "Outra especialidade" e gestão da lista.
-- A lista de especialidades é GLOBAL (vale para todos os condomínios), como a de categorias.

-- "já analisei este texto" (o admin decidiu manter como texto livre)
alter table public.providers add column if not exists custom_specialty_reviewed boolean not null default false;

-- Quando o morador escreve outro texto, ele volta para a fila.
create or replace function public.set_provider_specialties(p_provider uuid, p_specialty_ids int[], p_custom text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare ids int[]; v_condo uuid; v_custom text := nullif(trim(coalesce(p_custom, '')), '');
begin
  if not public.can_edit_provider(p_provider) then raise exception 'sem permissão'; end if;
  select array_agg(distinct x) into ids from unnest(coalesce(p_specialty_ids, '{}'::int[])) x where x is not null;
  ids := coalesce(ids, '{}'::int[]);
  if cardinality(ids) > 5 then raise exception 'max_specialties'; end if;
  if v_custom is not null and char_length(v_custom) not between 2 and 40 then raise exception 'especialidade inválida'; end if;
  select condo_id into v_condo from public.providers where id = p_provider;
  if exists (select 1 from unnest(ids) x
              where not exists (select 1 from public.specialties s
                                  join public.provider_categories pc on pc.category_id = s.category_id and pc.provider_id = p_provider
                                 where s.id = x)) then
    raise exception 'especialidade fora das categorias do perfil';
  end if;
  delete from public.provider_specialties where provider_id = p_provider and specialty_id <> all (ids);
  insert into public.provider_specialties (provider_id, specialty_id, condo_id)
    select p_provider, x, v_condo from unnest(ids) x on conflict do nothing;
  -- texto novo (ou alterado) volta para a fila de análise do admin
  update public.providers
     set custom_specialty = v_custom,
         custom_specialty_reviewed = case when v_custom is distinct from custom_specialty then false else custom_specialty_reviewed end
   where id = p_provider;
end $$;
grant execute on function public.set_provider_specialties(uuid, int[], text) to authenticated;

create or replace function public.slugify(p text) returns text
language sql stable set search_path = public as $$
  select trim(both '-' from regexp_replace(lower(unaccent(coalesce(p, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

-- Cria (p_id nulo) ou edita uma especialidade. Ao editar, a categoria não muda.
create or replace function public.admin_save_specialty(p_condo uuid, p_id int, p_category_id int, p_name text, p_keywords text)
returns int
language plpgsql security definer set search_path = public as $$
declare v_base text; v_slug text; n int := 1; v_id int;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  p_name := trim(coalesce(p_name, ''));
  p_keywords := lower(unaccent(trim(coalesce(p_keywords, ''))));
  if char_length(p_name) not between 2 and 60 then raise exception 'nome inválido'; end if;
  if char_length(p_keywords) > 300 then raise exception 'palavras de busca longas demais'; end if;
  if not exists (select 1 from public.categories where id = p_category_id) then raise exception 'categoria inválida'; end if;
  if exists (select 1 from public.specialties
              where category_id = p_category_id and lower(unaccent(name)) = lower(unaccent(p_name)) and id is distinct from p_id) then
    raise exception 'already_exists';
  end if;
  if p_id is null then
    v_base := public.slugify(p_name);
    if v_base = '' then raise exception 'nome inválido'; end if;
    v_slug := v_base;
    while exists (select 1 from public.specialties where category_id = p_category_id and slug = v_slug) loop
      n := n + 1; v_slug := v_base || '-' || n;
    end loop;
    insert into public.specialties (category_id, slug, name, keywords, sort)
    values (p_category_id, v_slug, p_name, p_keywords,
            coalesce((select max(sort) + 10 from public.specialties where category_id = p_category_id), 10))
    returning id into v_id;
  else
    update public.specialties set name = p_name, keywords = p_keywords
     where id = p_id and category_id = p_category_id returning id into v_id;
    if v_id is null then raise exception 'especialidade não encontrada'; end if;
  end if;
  return v_id;
end $$;
grant execute on function public.admin_save_specialty(uuid, int, int, text, text) to authenticated;

-- Exclui uma especialidade. Em quem a usa neste condomínio, o nome vira texto livre (nada se perde).
-- Recusa se outro condomínio também usa (a lista é global).
create or replace function public.admin_delete_specialty(p_condo uuid, p_id int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  if exists (select 1 from public.provider_specialties where specialty_id = p_id and condo_id <> p_condo) then
    raise exception 'in_use_elsewhere';
  end if;
  update public.providers p set custom_specialty = left(s.name, 40), custom_specialty_reviewed = true
    from public.provider_specialties ps join public.specialties s on s.id = ps.specialty_id
   where ps.specialty_id = p_id and ps.provider_id = p.id and p.custom_specialty is null;
  delete from public.specialties where id = p_id;
end $$;
grant execute on function public.admin_delete_specialty(uuid, int) to authenticated;

-- Atribui uma especialidade existente a perfis do condomínio e limpa o texto livre deles.
-- Pula quem não tem a categoria da especialidade ou já tem 5 especialidades. Devolve quantos foram atendidos.
create or replace function public.assign_specialty(p_condo uuid, p_specialty_id int, p_provider_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_cat int; n int := 0;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  select category_id into v_cat from public.specialties where id = p_specialty_id;
  if v_cat is null then raise exception 'especialidade não encontrada'; end if;
  create temp table _elig on commit drop as
    select p.id from public.providers p
     where p.condo_id = p_condo and p.id = any (p_provider_ids)
       and exists (select 1 from public.provider_categories pc where pc.provider_id = p.id and pc.category_id = v_cat)
       and (select count(*) from public.provider_specialties x where x.provider_id = p.id and x.specialty_id <> p_specialty_id) < 5;
  insert into public.provider_specialties (provider_id, specialty_id, condo_id)
    select id, p_specialty_id, p_condo from _elig on conflict do nothing;
  update public.providers set custom_specialty = null, custom_specialty_reviewed = false where id in (select id from _elig);
  get diagnostics n = row_count;
  drop table if exists _elig;
  return n;
end $$;
grant execute on function public.assign_specialty(uuid, int, uuid[]) to authenticated;

-- Aprova uma sugestão: cria a especialidade (ou reaproveita a de mesmo nome) e atribui aos perfis indicados.
create or replace function public.approve_specialty(p_condo uuid, p_category_id int, p_name text, p_keywords text, p_provider_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_id int;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  select id into v_id from public.specialties
   where category_id = p_category_id and lower(unaccent(name)) = lower(unaccent(trim(coalesce(p_name, ''))));
  if v_id is null then v_id := public.admin_save_specialty(p_condo, null, p_category_id, p_name, p_keywords); end if;
  return public.assign_specialty(p_condo, v_id, p_provider_ids);
end $$;
grant execute on function public.approve_specialty(uuid, int, text, text, uuid[]) to authenticated;

-- Quantos perfis do condomínio usam cada especialidade (para a lista do Admin).
create or replace function public.specialty_counts(p_condo uuid) returns table (specialty_id int, n bigint)
language sql stable set search_path = public as $$
  select specialty_id, count(*) from public.provider_specialties where condo_id = p_condo group by specialty_id;
$$;
grant execute on function public.specialty_counts(uuid) to authenticated;
