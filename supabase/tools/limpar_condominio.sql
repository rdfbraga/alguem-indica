-- ============================================================================
-- LIMPAR UM CONDOMÍNIO: apaga TODOS os prestadores (e o que depende deles: avaliações, fotos,
-- planos, visitas...) e TODOS os moradores, MENOS os administradores.
-- NÃO apaga o condomínio em si, nem anúncios, chaves de funcionalidades e categorias.
--
-- COMO USAR (no SQL Editor do Supabase), SEMPRE em duas etapas:
--   1) Rode do jeito que está: só mostra uma PRÉVIA do que seria apagado (nada é alterado).
--   2) Se estiver certo, troque v_apply para true, preencha v_confirm com o slug e rode de novo.
--
-- Antes de apagar, o script copia tudo para o esquema "backup_limpeza" (dentro do próprio banco).
-- ============================================================================
do $$
declare
  v_slug            text    := 'parque-barueri';   -- <<< condomínio a limpar
  v_apply           boolean := false;              -- <<< false = só prévia | true = APAGA DE VERDADE
  v_confirm         text    := '';                 -- <<< para apagar: escreva aqui o mesmo slug, entre aspas
  v_delete_accounts boolean := false;              -- <<< true = apaga também o LOGIN de quem não está em nenhum outro condomínio

  v_condo uuid; r record; t text; n int;
  v_stamp text := to_char(clock_timestamp() at time zone 'America/Sao_Paulo', 'YYYYMMDD_HH24MISSMS');
  v_tag   text;
  v_tables text[] := array['providers','provider_categories','provider_services','provider_photos',
                           'reviews','profile_claims','feedback','reports','members'];
  c_prov int; c_rev int; c_mem int; c_adm int; c_fb int; c_acc int;
begin
  select id into v_condo from public.condominiums where slug = v_slug;
  if v_condo is null then raise exception 'Condomínio "%" não encontrado.', v_slug; end if;
  select count(*) into c_adm from public.members where condo_id = v_condo and role = 'admin';
  if c_adm = 0 then
    raise exception 'O condomínio "%" não tem nenhum administrador. Nada será apagado (ele ficaria sem acesso).', v_slug;
  end if;

  select count(*) into c_prov from public.providers where condo_id = v_condo;
  select count(*) into c_rev  from public.reviews   where condo_id = v_condo;
  select count(*) into c_mem  from public.members   where condo_id = v_condo and role <> 'admin';
  select count(*) into c_fb   from public.feedback  where condo_id = v_condo
     and user_id in (select user_id from public.members where condo_id = v_condo and role <> 'admin');
  select count(*) into c_acc  from public.members m where m.condo_id = v_condo and m.role <> 'admin'
     and not exists (select 1 from public.members o where o.user_id = m.user_id and o.condo_id <> v_condo);

  raise notice '=== % : %', case when v_apply then 'APAGANDO' else 'PRÉVIA (nada foi alterado)' end, v_slug;
  raise notice 'Administradores que PERMANECEM (%):', c_adm;
  for r in select m.full_name, m.block, m.unit, u.email from public.members m left join auth.users u on u.id = m.user_id
            where m.condo_id = v_condo and m.role = 'admin' order by m.full_name loop
    raise notice '   - % (Bloco %, un. %) <%>', r.full_name, r.block, r.unit, r.email;
  end loop;
  raise notice 'Serão apagados: % prestadores, % avaliações, % moradores (% mensagens de Ajuda deles).', c_prov, c_rev, c_mem, c_fb;
  raise notice 'Contas de login que só existem neste condomínio: % (%).', c_acc,
    case when v_delete_accounts then 'serão apagadas' else 'ficam; a pessoa só perde o acesso a este condomínio' end;
  for r in select m.full_name, m.block, m.unit from public.members m
            where m.condo_id = v_condo and m.role <> 'admin' order by m.created_at limit 15 loop
    raise notice '   morador: % (Bloco %, un. %)', r.full_name, r.block, r.unit;
  end loop;
  if c_mem > 15 then raise notice '   ... e mais % moradores', c_mem - 15; end if;

  if not v_apply then
    raise notice 'Nada foi apagado. Para apagar: mude v_apply para true, preencha v_confirm com ''%'' e rode de novo.', v_slug;
    return;
  end if;
  if v_confirm is distinct from v_slug then
    raise exception 'Confirmação incorreta. Preencha v_confirm com exatamente: %', v_slug;
  end if;

  -- 1) cópia de segurança (esquema backup_limpeza; apague depois de conferir: drop schema backup_limpeza cascade;)
  create schema if not exists backup_limpeza;
  v_tag := left(replace(v_slug, '-', '_'), 20) || '_' || v_stamp;
  foreach t in array v_tables loop
    execute format('create table backup_limpeza.%I as select * from public.%I where condo_id = %L', t || '_' || v_tag, t, v_condo);
  end loop;

  -- 2) apagar (tudo na mesma transação: se algo falhar, nada muda)
  create temp table _remover on commit drop as
    select user_id from public.members where condo_id = v_condo and role <> 'admin';

  delete from public.reports   where condo_id = v_condo;
  delete from public.providers where condo_id = v_condo;            -- leva junto avaliações, fotos, serviços, planos, visitas, pedidos de posse
  delete from public.feedback  where condo_id = v_condo and user_id in (select user_id from _remover);
  delete from public.members   where condo_id = v_condo and role <> 'admin';
  get diagnostics n = row_count;
  raise notice 'Moradores removidos do condomínio: %', n;

  if v_delete_accounts then
    delete from auth.users u using _remover x
     where u.id = x.user_id and not exists (select 1 from public.members m where m.user_id = u.id);
    get diagnostics n = row_count;
    raise notice 'Contas de login apagadas: %', n;
  end if;

  raise notice 'Concluído. Cópia de segurança em backup_limpeza (sufixo %).', v_tag;
  raise notice 'Atenção: as FOTOS enviadas continuam no armazenamento (Storage > provider-photos); apague pelo painel se quiser.';
end $$;
