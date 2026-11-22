-- "Meus condomínios": os condomínios ativos em que a pessoa é moradora (para trocar de condomínio sem digitar link). Idempotente.
create or replace function public.my_condos()
returns table (condo_id uuid, slug text, name text, role text, region_slug text)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, m.role, r.slug
    from public.members m
    join public.condominiums c on c.id = m.condo_id and c.is_active
    left join public.regions r on r.id = c.region_id
   where auth.uid() is not null and m.user_id = auth.uid()
   order by m.created_at;
$$;
grant execute on function public.my_condos() to authenticated;
