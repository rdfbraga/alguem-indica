-- Busca inteligente: sem acento, tolerante a erros de digitação e com sinônimos por categoria.
create extension if not exists unaccent schema public;

alter table public.categories add column if not exists keywords text not null default '';

update public.categories c set keywords = v.k
from (values
  ('diarista',        'faxina faxineira limpeza domestica passadeira passar roupa'),
  ('encanador',       'bombeiro hidraulico vazamento cano torneira desentupidora esgoto caixa dagua'),
  ('eletricista',     'luz tomada fiacao chuveiro disjuntor lampada instalacao eletrica'),
  ('pintor',          'pintura parede textura massa corrida reforma'),
  ('marceneiro',      'moveis armario carpinteiro planejados madeira montador'),
  ('ar-condicionado', 'ar condicionado split refrigeracao instalacao limpeza manutencao'),
  ('baba',            'cuidadora crianca bebe nanny'),
  ('personal',        'treino academia musculacao pilates yoga funcional professor'),
  ('passeador',       'cachorro cao pet dog walker veterinario banho tosa gato'),
  ('manicure',        'unha sobrancelha depilacao estetica massagem cilios design'),
  ('cabeleireiro',    'cabelo corte barbeiro escova coloracao barba'),
  ('aulas',           'professor reforco ingles musica explicador matematica'),
  ('marmita',         'comida bolo doce salgado festa confeitaria quentinha almoco'),
  ('tecnico',         'televisao tv computador notebook celular wifi internet informatica conserto'),
  ('chaveiro',        'chave fechadura abertura porta copia'),
  ('mudanca',         'frete carreto transporte caminhao montador')
) as v(slug, k)
where c.slug = v.slug;

-- Devolve os ids dos prestadores do condomínio que casam com a busca, com uma pontuação.
-- Roda como o usuário (security invoker): o RLS continua valendo.
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
           lower(unaccent(c.name || ' ' || c.keywords)) as c
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
