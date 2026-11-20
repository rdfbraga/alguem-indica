-- Define QUEM é administrador da plataforma (cria condomínios e regiões pelo painel Admin → Condomínios).
-- Requer a migration 0024_platform_admin.sql. Troque o e-mail (a pessoa já precisa ter entrado no app) e rode.
insert into public.platform_admins (user_id)
select id from auth.users where lower(email) = lower('seu@email.com')   -- <<< EDITE
on conflict do nothing;

-- Conferência: deve listar o e-mail.
select u.email from public.platform_admins pa join auth.users u on u.id = pa.user_id;

-- Para remover:  delete from public.platform_admins where user_id = (select id from auth.users where email = '...');
