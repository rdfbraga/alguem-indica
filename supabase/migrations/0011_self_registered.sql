-- Perfis cadastrados pelo próprio morador: o autor tem um pedido de posse pendente e o perfil ainda não tem dono.
-- A listagem passa a expor isso (self_pending) para o app mostrar "cadastrado pelo próprio · aguardando confirmação".
create or replace function public.provider_self_pending(p_provider uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.profile_claims c
      join public.providers p on p.id = c.provider_id
     where c.provider_id = p_provider and c.user_id = p.created_by and c.status = 'pending' and p.owner_id is null);
$$;
grant execute on function public.provider_self_pending(uuid) to authenticated;

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
          from public.provider_categories x join public.categories c2 on c2.id = x.category_id where x.provider_id = p.id) as category_names,
       public.plan_is_active(p.id) as plan_active,
       public.provider_self_pending(p.id) as self_pending
from public.providers p
join public.categories c on c.id = p.category_id
left join public.reviews r on r.provider_id = p.id
group by p.id, c.id;
grant select on public.provider_listing to authenticated;
