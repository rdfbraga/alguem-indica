-- Busca de perfis pelo nome ou WhatsApp, sem diferenciar acento ("joao" acha "João"), com tolerância a erro de digitação.
-- Usada em "Esse profissional já está no app?" e na aba Perfis do Admin. Roda com as permissões de quem chama
-- (só encontra perfis que a pessoa já poderia ver). Idempotente.
create or replace function public.find_provider_ids(p_condos uuid[], p_q text, p_limit int default 10)
returns table (id uuid)
language sql stable set search_path = public as $$
  with q as (
    select replace(replace(lower(unaccent(trim(coalesce(p_q, '')))), '%', ''), '_', '') as t,
           regexp_replace(coalesce(p_q, ''), '\D', '', 'g') as d
  )
  select p.id
    from public.providers p, q
   where p.condo_id = any (p_condos)
     and (char_length(q.t) >= 2 or char_length(q.d) >= 4)
     and ((char_length(q.t) >= 2 and (lower(unaccent(p.name)) like '%' || q.t || '%'
                                      or word_similarity(q.t, lower(unaccent(p.name))) > 0.45))
          or (char_length(q.d) >= 4 and p.whatsapp like '%' || q.d || '%'))
   order by (lower(unaccent(p.name)) like q.t || '%') desc,
            word_similarity(q.t, lower(unaccent(p.name))) desc, p.name
   limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
grant execute on function public.find_provider_ids(uuid[], text, int) to authenticated;
