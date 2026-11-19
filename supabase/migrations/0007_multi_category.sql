-- Um perfil pode atender até 3 categorias (ex.: Eletricista + Encanador).
-- providers.category_id continua sendo a categoria PRINCIPAL; provider_categories lista todas (incluindo a principal).
create table if not exists public.provider_categories (
  provider_id uuid not null references public.providers(id) on delete cascade,
  category_id int not null references public.categories(id),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  primary key (provider_id, category_id)
);
create index if not exists provider_categories_cat_idx on public.provider_categories (category_id, condo_id);

-- Quem já está cadastrado entra com a categoria atual.
insert into public.provider_categories (provider_id, category_id, condo_id)
select id, category_id, condo_id from public.providers
on conflict do nothing;

-- Máximo de 3 categorias por perfil.
create or replace function public.provider_categories_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Linha que já existe (será ignorada pelo "on conflict do nothing"): não conta para o limite.
  if exists (select 1 from public.provider_categories
              where provider_id = new.provider_id and category_id = new.category_id) then
    return new;
  end if;
  if (select count(*) from public.provider_categories where provider_id = new.provider_id) >= 3 then
    raise exception 'max_categories' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists provider_categories_before_insert on public.provider_categories;
create trigger provider_categories_before_insert before insert on public.provider_categories
  for each row execute function public.provider_categories_limit();

-- A categoria principal sempre está na lista (novo perfil, ou troca feita pelo admin).
create or replace function public.providers_sync_primary() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.provider_categories (provider_id, category_id, condo_id)
  values (new.id, new.category_id, new.condo_id)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists providers_after_insert_cat on public.providers;
create trigger providers_after_insert_cat after insert on public.providers
  for each row execute function public.providers_sync_primary();
drop trigger if exists providers_after_update_cat on public.providers;
create trigger providers_after_update_cat after update of category_id on public.providers
  for each row execute function public.providers_sync_primary();

alter table public.provider_categories enable row level security;
drop policy if exists provider_categories_read on public.provider_categories;
create policy provider_categories_read on public.provider_categories for select to authenticated
  using (public.is_member(condo_id));
grant select on public.provider_categories to authenticated;

-- Quem pode editar o perfil: quem indicou ou o admin do condomínio.
create or replace function public.can_edit_provider(p_provider uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.providers p
                 where p.id = p_provider and (p.created_by = auth.uid() or public.is_admin(p.condo_id)));
$$;
grant execute on function public.can_edit_provider(uuid) to authenticated;

-- Define as categorias do perfil (a primeira é a principal). "Outros" exige o texto do que a pessoa faz.
create or replace function public.set_provider_categories(p_provider uuid, p_category_ids int[], p_custom text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare ids int[]; v_condo uuid; v_other int; v_custom text;
begin
  if not public.can_edit_provider(p_provider) then raise exception 'sem permissão'; end if;
  select array_agg(x order by ord) into ids
    from (select distinct on (x) x, ord from unnest(p_category_ids) with ordinality as t(x, ord) where x is not null order by x, ord) d;
  select array_agg(x order by ord) into ids
    from (select x, ord from unnest(ids) with ordinality as t(x, ord)) s;
  if ids is null or cardinality(ids) not between 1 and 3 then raise exception 'escolha de 1 a 3 categorias'; end if;
  if (select count(*) from public.categories where id = any (ids)) <> cardinality(ids) then raise exception 'categoria inválida'; end if;

  select condo_id into v_condo from public.providers where id = p_provider;
  select id into v_other from public.categories where slug = 'outros';
  v_custom := nullif(trim(coalesce(p_custom, '')), '');
  if v_other = any (ids) then
    if v_custom is null or char_length(v_custom) not between 2 and 40 then raise exception 'custom_required'; end if;
  else
    v_custom := null;
  end if;

  delete from public.provider_categories where provider_id = p_provider and category_id <> all (ids);
  insert into public.provider_categories (provider_id, category_id, condo_id)
    select p_provider, c, v_condo from unnest(ids) c on conflict do nothing;
  update public.providers
     set category_id = ids[1],
         custom_category = v_custom,
         custom_category_reviewed = case when v_custom is distinct from custom_category then false else custom_category_reviewed end
   where id = p_provider;
end $$;
grant execute on function public.set_provider_categories(uuid, int[], text) to authenticated;

-- Admin resolve uma sugestão de categoria: troca "Outros" por outra categoria nos perfis indicados.
create or replace function public.replace_other_category(p_condo uuid, p_provider_ids uuid[], p_category_id int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_other int;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  select id into v_other from public.categories where slug = 'outros';
  -- principal "Outros" passa a ser a nova categoria
  update public.providers set category_id = p_category_id, custom_category = null, custom_category_reviewed = false
   where condo_id = p_condo and id = any (p_provider_ids) and category_id = v_other;
  -- perfis em que "Outros" era categoria extra: tira "Outros" e inclui a nova (se couber)
  delete from public.provider_categories pc using public.providers p
   where pc.provider_id = p.id and p.condo_id = p_condo and p.id = any (p_provider_ids) and pc.category_id = v_other;
  insert into public.provider_categories (provider_id, category_id, condo_id)
    select p.id, p_category_id, p_condo from public.providers p
     where p.condo_id = p_condo and p.id = any (p_provider_ids)
       and (select count(*) from public.provider_categories x where x.provider_id = p.id) < 3
    on conflict do nothing;
  update public.providers set custom_category = null, custom_category_reviewed = false
   where condo_id = p_condo and id = any (p_provider_ids);
end $$;
grant execute on function public.replace_other_category(uuid, uuid[], int) to authenticated;

-- approve_category passa a usar a função acima para mover os perfis.
create or replace function public.approve_category(p_condo uuid, p_name text, p_icon text, p_group_id int, p_provider_ids uuid[])
returns text
language plpgsql security definer set search_path = public as $$
declare v_slug text; v_base text; v_id int; n int := 1;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  p_name := trim(p_name);
  if char_length(p_name) not between 2 and 40 then raise exception 'nome da categoria inválido'; end if;
  p_icon := coalesce(nullif(trim(p_icon), ''), '✨');
  if char_length(p_icon) > 8 then raise exception 'ícone inválido'; end if;
  if not exists (select 1 from public.category_groups where id = p_group_id) then raise exception 'grupo inválido'; end if;

  v_base := trim(both '-' from regexp_replace(lower(unaccent(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then raise exception 'nome da categoria inválido'; end if;
  v_slug := v_base;
  while exists (select 1 from public.categories where slug = v_slug) loop
    n := n + 1; v_slug := v_base || '-' || n;
  end loop;

  insert into public.categories (slug, name, icon, sort, group_id)
  values (v_slug, p_name, p_icon, 500, p_group_id) returning id into v_id;

  perform public.replace_other_category(p_condo, p_provider_ids, v_id);
  return v_slug;
end $$;

-- A listagem agora traz todas as categorias do perfil.
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

-- Busca considera todas as categorias do perfil.
create or replace function public.search_provider_ids(p_condo uuid, p_q text)
returns table (id uuid, score real)
language sql stable set search_path = public as $$
  with toks as (
    select t from unnest(string_to_array(
      regexp_replace(lower(unaccent(trim(coalesce(p_q, '')))), '[%_\\]', '', 'g'), ' ')) as t
    where char_length(t) >= 2
  ), docs as (
    select p.id,
           lower(unaccent(p.name)) as n,
           lower(unaccent(p.description)) as d,
           lower(unaccent(coalesce((select string_agg(c.name || ' ' || c.keywords, ' ')
                                      from provider_categories pc join categories c on c.id = pc.category_id
                                     where pc.provider_id = p.id), '') || ' ' || coalesce(p.custom_category, ''))) as c
    from providers p
    where p.condo_id = p_condo and p.status = 'active'
  )
  select docs.id,
         (select coalesce(avg(greatest(
              case when docs.n like '%' || t || '%' then 1.0 else 0.0 end,
              case when docs.c like '%' || t || '%' then 0.8 else 0.0 end,
              case when docs.d like '%' || t || '%' then 0.5 else 0.0 end,
              word_similarity(t, docs.n),
              word_similarity(t, docs.c) * 0.8)), 0) from toks)::real as score
  from docs
  where exists (select 1 from toks)
    and not exists (
      select 1 from toks
      where not (docs.n like '%' || t || '%'
              or docs.c like '%' || t || '%'
              or docs.d like '%' || t || '%'
              or word_similarity(t, docs.n) > 0.5
              or word_similarity(t, docs.c) > 0.5))
  order by score desc
  limit 100;
$$;
grant execute on function public.search_provider_ids(uuid, text) to authenticated;
