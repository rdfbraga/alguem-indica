-- Visão unificada: números e pendências de TODOS os condomínios que a pessoa administra. Idempotente.
create or replace function public.admin_overview()
returns table (
  condo_id uuid, slug text, name text, region_name text,
  members bigint, members_new bigint, providers bigint, reviews_new bigint, whatsapp_30d bigint, active_7d bigint,
  pend_feedback bigint, pend_claims bigint, pend_flagged bigint, pend_reports bigint, pend_categories bigint, pend_specialties bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, r.name,
    (select count(*) from public.members m where m.condo_id = c.id),
    (select count(*) from public.members m where m.condo_id = c.id and m.created_at > now() - interval '30 days'),
    (select count(*) from public.providers p where p.condo_id = c.id and p.status = 'active'),
    (select count(*) from public.reviews v where v.condo_id = c.id and v.status = 'visible' and v.created_at > now() - interval '30 days'),
    (select count(*) from public.provider_events e where coalesce(e.viewer_condo_id, e.condo_id) = c.id and e.kind = 'whatsapp' and e.created_at > now() - interval '30 days'),
    (select count(distinct e.user_id) from public.provider_events e where coalesce(e.viewer_condo_id, e.condo_id) = c.id and e.created_at > now() - interval '7 days'),
    (select count(*) from public.feedback f where f.condo_id = c.id and f.status = 'new'),
    (select count(*) from public.profile_claims pc where pc.condo_id = c.id and pc.status = 'pending'),
    (select count(*) from public.providers p where p.condo_id = c.id and p.flagged),
    (select count(*) from public.reports rp where rp.condo_id = c.id and rp.status = 'open'),
    (select count(*) from public.providers p where p.condo_id = c.id and p.custom_category is not null and not p.custom_category_reviewed),
    (select count(*) from public.providers p where p.condo_id = c.id and p.custom_specialty is not null and not p.custom_specialty_reviewed)
  from public.condominiums c
  left join public.regions r on r.id = c.region_id
  where auth.uid() is not null and public.is_admin(c.id)
  order by c.name;
$$;
grant execute on function public.admin_overview() to authenticated;
