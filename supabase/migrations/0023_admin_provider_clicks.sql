-- Cliques e visitas dos últimos 30 dias de uma lista de perfis, só para quem administra o condomínio do perfil. Idempotente.
create or replace function public.admin_provider_clicks(p_ids uuid[])
returns table (provider_id uuid, whatsapp bigint, views bigint)
language sql stable security definer set search_path = public as $$
  select p.id,
         count(e.id) filter (where e.kind = 'whatsapp'),
         count(e.id) filter (where e.kind = 'view')
    from public.providers p
    left join public.provider_events e on e.provider_id = p.id and e.created_at > now() - interval '30 days'
   where p.id = any (coalesce(p_ids, '{}')) and public.is_admin(p.condo_id)
   group by p.id;
$$;
grant execute on function public.admin_provider_clicks(uuid[]) to authenticated;
