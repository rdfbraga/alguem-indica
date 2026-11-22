-- Link da região: uma página pública (/r/<região>) em que a pessoa escolhe o próprio condomínio. Idempotente.

-- Condomínios ativos de uma região, pelo identificador dela. Pode ser chamada sem login: só devolve nomes e links.
create or replace function public.region_public(p_slug text)
returns table (region_name text, condo_id uuid, condo_slug text, condo_name text)
language sql stable security definer set search_path = public as $$
  select r.name, c.id, c.slug, c.name
    from public.regions r join public.condominiums c on c.region_id = r.id and c.is_active
   where r.slug = lower(trim(coalesce(p_slug, '')))
   order by c.name;
$$;
grant execute on function public.region_public(text) to anon, authenticated;

-- Identificador e nome da região do condomínio (para o convite escolher entre o link do condomínio e o da região).
create or replace function public.condo_region_info(p_condo uuid)
returns table (slug text, name text)
language sql stable security definer set search_path = public as $$
  select r.slug, r.name
    from public.condominiums c join public.regions r on r.id = c.region_id
   where c.id = p_condo and public.is_member(p_condo);
$$;
grant execute on function public.condo_region_info(uuid) to authenticated;
