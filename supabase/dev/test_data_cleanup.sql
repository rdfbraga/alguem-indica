-- Remove todos os dados criados por supabase/dev/test_data.sql (prestadores, avaliações e vizinhos fictícios).
-- Não toca nos seus cadastros reais.
delete from public.providers where created_by in (select id from auth.users where email like '%@teste.alguemindica.invalid');
delete from public.reviews   where author_id  in (select id from auth.users where email like '%@teste.alguemindica.invalid');
delete from public.members   where user_id    in (select id from auth.users where email like '%@teste.alguemindica.invalid');
delete from auth.users       where email like '%@teste.alguemindica.invalid';
-- Anúncios de teste (migration 0010; ignora se a tabela ainda não existir)
do $$ begin
  if to_regclass('public.ads') is not null then delete from public.ads where advertiser like 'Teste · %'; end if;
end $$;
