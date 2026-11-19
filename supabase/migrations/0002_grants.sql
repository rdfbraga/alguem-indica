-- Projetos novos do Supabase nem sempre concedem acesso às tabelas do schema public.
-- Concede o necessário; a segurança continua garantida pelo RLS.
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.condominiums, public.provider_listing to authenticated;
grant select, insert on public.members, public.providers, public.reviews, public.reports to authenticated;
grant update on public.providers, public.reviews, public.reports to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.condo_by_slug(text) to anon, authenticated;
grant execute on function public.is_member(uuid), public.is_admin(uuid), public.condo_is_active(uuid) to authenticated;
