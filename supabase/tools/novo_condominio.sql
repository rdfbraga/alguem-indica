-- ============================================================================
-- NOVO CONDOMÍNIO — rode no SQL Editor do Supabase.
-- 1) Edite as 3 linhas marcadas com <<< EDITE.
-- 2) Clique em Run. A mensagem final mostra o link.
-- Pode ser repetido com outro slug para criar mais condomínios.
-- ============================================================================
do $$
declare
  v_slug        text := 'novo-condominio';       -- <<< EDITE: vira o link /c/<slug> (minúsculas, números e hífen)
  v_name        text := 'Novo Condomínio';       -- <<< EDITE: nome que aparece no app e no ícone instalado
  v_admin_email text := 'seu@email.com';         -- <<< EDITE: e-mail de quem vai administrar (já precisa ter entrado no app alguma vez)
  v_condo uuid; v_admin uuid; v_full text;
begin
  if v_slug !~ '^[a-z0-9-]+$' then raise exception 'O slug só pode ter letras minúsculas, números e hífen: %', v_slug; end if;
  if exists (select 1 from public.condominiums where slug = v_slug) then raise exception 'Já existe um condomínio com o slug "%"', v_slug; end if;

  insert into public.condominiums (slug, name) values (v_slug, v_name) returning id into v_condo;

  select id into v_admin from auth.users where lower(email) = lower(v_admin_email);
  if v_admin is null then
    raise notice 'Condomínio criado, mas NÃO achei o e-mail % entre os usuários. Peça para a pessoa abrir /c/% e concluir o cadastro; depois rode: update public.members set role = ''admin'' where user_id = (select id from auth.users where email = ''%'') and condo_id = ''%'';', v_admin_email, v_slug, v_admin_email, v_condo;
  else
    -- aproveita o nome já cadastrado em outro condomínio; a pessoa entra direto como administradora
    select full_name into v_full from public.members where user_id = v_admin limit 1;
    insert into public.members (user_id, condo_id, full_name, block, unit, role)
    values (v_admin, v_condo, coalesce(v_full, split_part(v_admin_email, '@', 1)), 'Adm', '0', 'admin')
    on conflict (user_id, condo_id) do update set role = 'admin';
    raise notice 'Administrador: % (já pode abrir o Admin).', v_admin_email;
  end if;
  raise notice 'Pronto! Link do condomínio: https://www.alguemindica.app.br/c/%', v_slug;
end $$;

-- Para APAGAR um condomínio e tudo que há nele (moradores, prestadores, avaliações...), use com muito cuidado:
--   delete from public.condominiums where slug = 'slug-aqui';
