-- Sugestão de categoria quando o morador escolhe "Outros".
alter table public.providers
  add column if not exists custom_category text
  check (custom_category is null or char_length(custom_category) between 2 and 40);
-- true = admin já analisou e decidiu manter em "Outros" (o rótulo continua aparecendo).
alter table public.providers add column if not exists custom_category_reviewed boolean not null default false;

-- A view lista as colunas de providers (p.*): recriar para incluir custom_category.
drop view if exists public.provider_listing;
create view public.provider_listing with (security_invoker = true) as
select p.*, c.slug as category_slug, c.name as category_name, c.icon as category_icon,
       coalesce(avg(r.rating) filter (where r.status = 'visible'), 0)::numeric(3,2) as avg_rating,
       count(r.id) filter (where r.status = 'visible')::int as review_count
from public.providers p
join public.categories c on c.id = p.category_id
left join public.reviews r on r.provider_id = p.id
group by p.id, c.id;
grant select on public.provider_listing to authenticated;

-- A sugestão só vale na categoria "Outros".
create or replace function public.providers_check_flags() returns trigger
language plpgsql security definer set search_path = public as $$
declare similar_name text; recent int; cat_slug text;
begin
  -- O cliente nunca define moderação: sempre recalculamos aqui.
  new.status := 'active';
  new.flagged := false;
  new.flag_reason := null;
  new.custom_category_reviewed := false;
  select slug into cat_slug from public.categories where id = new.category_id;
  if cat_slug is distinct from 'outros' then new.custom_category := null; end if;
  new.custom_category := nullif(trim(new.custom_category), '');

  select p.name into similar_name from public.providers p
   where p.condo_id = new.condo_id and p.category_id = new.category_id
     and similarity(lower(p.name), lower(new.name)) > 0.55
   order by similarity(lower(p.name), lower(new.name)) desc limit 1;
  if similar_name is not null then
    new.flagged := true;
    new.flag_reason := 'Nome parecido com "' || similar_name || '" na mesma categoria';
  end if;
  select count(*) into recent from public.providers
   where created_by = new.created_by and created_at > now() - interval '24 hours';
  if recent >= 5 then
    new.flagged := true;
    new.flag_reason := coalesce(new.flag_reason || '; ', '') || 'Mesmo morador cadastrou muitos prestadores em 24h';
  end if;
  return new;
end $$;

-- A busca também encontra pela categoria sugerida (ex.: "dedetização").
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
           lower(unaccent(c.name || ' ' || c.keywords || ' ' || coalesce(p.custom_category, ''))) as c
    from providers p join categories c on c.id = p.category_id
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

-- Admin aprova a sugestão: cria a categoria e move os prestadores indicados.
-- Categorias são globais (valem para todos os condomínios); por isso só passa por aqui.
create or replace function public.approve_category(p_condo uuid, p_name text, p_icon text, p_provider_ids uuid[])
returns text
language plpgsql security definer set search_path = public as $$
declare v_slug text; v_base text; v_id int; n int := 1;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  p_name := trim(p_name);
  if char_length(p_name) not between 2 and 40 then raise exception 'nome da categoria inválido'; end if;
  p_icon := coalesce(nullif(trim(p_icon), ''), '✨');
  if char_length(p_icon) > 8 then raise exception 'ícone inválido'; end if;

  v_base := trim(both '-' from regexp_replace(lower(unaccent(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then raise exception 'nome da categoria inválido'; end if;
  v_slug := v_base;
  while exists (select 1 from public.categories where slug = v_slug) loop
    n := n + 1; v_slug := v_base || '-' || n;
  end loop;

  insert into public.categories (slug, name, icon, sort) values (v_slug, p_name, p_icon, 500)
  returning id into v_id;

  update public.providers set category_id = v_id, custom_category = null, custom_category_reviewed = false
   where condo_id = p_condo and id = any (p_provider_ids);
  return v_slug;
end $$;
grant execute on function public.approve_category(uuid, text, text, uuid[]) to authenticated;
