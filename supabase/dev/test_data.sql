-- ============================================================================
-- DADOS DE TESTE do Alguém indica? — rode no SQL Editor do Supabase.
--  * Cria ~60 prestadores (3 a 4 por categoria) e 15 vizinhos FICTÍCIOS que avaliam.
--  * Usa o condomínio mais antigo cadastrado (troque v_slug para escolher outro).
--  * Pode rodar de novo: apaga os dados de teste anteriores antes de recriar.
--  * Para remover tudo depois: rode supabase/dev/test_data_cleanup.sql.
--  * Os telefones são fictícios (55 11 9 0000 00xx). NÃO use em produção real.
-- ============================================================================
do $$
declare
  v_slug  text := null;            -- ex.: 'parque-barueri'. null = condomínio mais antigo.
  v_condo uuid;
  v_domain constant text := '@teste.alguemindica.invalid';
  u record; p record; r record;
  v_user_ids uuid[] := '{}';
  v_creator uuid;
  v_n int; v_rating int; v_x float8; i int := 0;
  v_comment text;
  c5 text[] := array['Excelente! Pontual e muito caprichoso.','Recomendo muito, resolveu rápido.','Atendimento ótimo e preço justo.','Já contratei mais de uma vez, sempre bom.','Super educado e honesto. Voltarei a chamar.'];
  c4 text[] := array['Bom serviço, só atrasou um pouco.','Gostei, voltarei a contratar.','Fez direitinho, recomendo.'];
  c3 text[] := array['Serviço ok, mas achei um pouco caro.','Cumpriu o combinado, nada de especial.'];
  c2 text[] := array['Demorou além do combinado.','Esperava mais pelo valor cobrado.'];
begin
  -- condomínio alvo
  if v_slug is null then
    select id into v_condo from public.condominiums order by created_at limit 1;
  else
    select id into v_condo from public.condominiums where slug = v_slug;
  end if;
  if v_condo is null then raise exception 'Condomínio não encontrado. Rode antes o seed.sql.'; end if;

  -- limpa dados de teste anteriores
  delete from public.providers where created_by in (select id from auth.users where email like '%' || v_domain);
  delete from public.reviews   where author_id  in (select id from auth.users where email like '%' || v_domain);
  delete from public.members   where user_id    in (select id from auth.users where email like '%' || v_domain);
  delete from auth.users       where email like '%' || v_domain;

  -- 15 vizinhos fictícios
  for u in
    select * from (values
      ('Carla Mendes','A','101'),('Roberto Alves','A','305'),('Fernanda Lima','B','202'),('Paulo Souza','B','408'),
      ('Juliana Costa','C','110'),('Marcelo Rocha','C','512'),('Aline Barbosa','D','207'),('Diego Martins','D','603'),
      ('Patrícia Gomes','E','304'),('Rafael Teixeira','E','801'),('Luciana Ribeiro','F','115'),('Eduardo Pinto','F','406'),
      ('Camila Duarte','G','209'),('Bruno Carvalho','G','710'),('Renata Nunes','H','503')
    ) as t(nm, blk, un)
  loop
    i := i + 1;
    v_creator := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_creator, 'authenticated', 'authenticated',
            'vizinho' || i || v_domain, now(), now(), now());
    insert into public.members (user_id, condo_id, full_name, block, unit)
    values (v_creator, v_condo, u.nm, u.blk, u.un);
    v_user_ids := v_user_ids || v_creator;
  end loop;

  -- prestadores
  i := 0;
  for p in
    select * from (values
      ('diarista','Cláudia Faxinas','external',null,'Faxina completa e pós-obra. Leva os próprios produtos.'),
      ('diarista','Rosa Maria','resident','B','Diarista de segunda a sexta. Referências aqui no condomínio.'),
      ('diarista','Equipe Brilho Limpo','external',null,'Limpeza pesada, vidros e passadoria.'),
      ('diarista','Nete Passadeira','external',null,'Passo roupa e organizo armários. Busco e entrego no bloco.'),

      ('encanador','Seu Joaquim Hidráulica','external',null,'Vazamentos, torneiras, registros e caixa d''água.'),
      ('encanador','Marcos Desentupidora 24h','external',null,'Desentupimento de pias, ralos e esgoto. Atende urgência.'),
      ('encanador','Paulo Encanador','resident','A','Moro no bloco A. Instalação de chuveiro, pias e vasos.'),

      ('eletricista','Wagner Elétrica','external',null,'Instalações, quadro de luz e troca de tomadas. Nota fiscal.'),
      ('eletricista','Eletro Rápido do Zé','external',null,'Chuveiro, ventilador de teto e luminárias.'),
      ('eletricista','Fábio Instalações','resident','C','Elétrica residencial e iluminação em LED.'),
      ('eletricista','Ricardo Eletricista','external',null,'Atendimento em até 24h, orçamento sem compromisso.'),

      ('pintor','Pinturas Silva','external',null,'Pintura de apartamentos, textura e massa corrida.'),
      ('pintor','Adriano Pintor','external',null,'Acabamento fino e entrega no prazo.'),
      ('pintor','Cores & Acabamentos','external',null,'Pintura e pequenos reparos em gesso.'),

      ('marceneiro','Marcenaria Pereira','external',null,'Móveis sob medida, armários e closets.'),
      ('marceneiro','Jorge Móveis Planejados','external',null,'Cozinhas e dormitórios planejados.'),
      ('marceneiro','Alê Marceneiro','resident','D','Reparos e montagem de móveis. Moro no bloco D.'),

      ('ar-condicionado','Frio Certo Refrigeração','external',null,'Instalação, limpeza e manutenção de split.'),
      ('ar-condicionado','Climatiza Já','external',null,'Higienização de ar-condicionado e carga de gás.'),
      ('ar-condicionado','Renan Ar Split','resident','B','Instalação de split com garantia. Bloco B.'),

      ('baba','Tia Bia','resident','A','Babá com 10 anos de experiência. Bloco A.'),
      ('baba','Juliana Babá','external',null,'Cuidadora de crianças e bebês, com referências.'),
      ('baba','Dani Cuidadora','external',null,'Folguista para noites e fins de semana.'),

      ('personal','Prof. Thiago Treinos','resident','C','Personal no condomínio e na academia. Bloco C.'),
      ('personal','Camila Pilates','external',null,'Pilates solo e funcional em domicílio.'),
      ('personal','Lucas Funcional ao ar livre','external',null,'Treinos em grupo na área verde, de manhã cedo.'),
      ('personal','Personal Renata','external',null,'Emagrecimento e condicionamento. Aula experimental grátis.'),

      ('passeador','Pet Passeio Ana','external',null,'Passeios diários e pet sitter. Envia fotos.'),
      ('passeador','Dog Walker Caio','resident','E','Passeio de cães com segurança. Moro no bloco E.'),
      ('passeador','Banho & Tosa Móvel','external',null,'Vamos até o seu apartamento. Cães e gatos.'),

      ('manicure','Manicure Lu','external',null,'Mãos e pés, esmaltação em gel. Atende em casa.'),
      ('manicure','Studio Priscila Nails','resident','B','Alongamento e nail art. Bloco B.'),
      ('manicure','Sobrancelhas da Duda','external',null,'Design de sobrancelha, cílios e depilação.'),

      ('cabeleireiro','Salão da Márcia','external',null,'Corte, escova e coloração em domicílio.'),
      ('cabeleireiro','Barbeiro Léo','resident','A','Corte masculino e barba. Bloco A.'),
      ('cabeleireiro','Hair Home Fernanda','external',null,'Progressiva, hidratação e cortes femininos.'),

      ('aulas','Prof. Helena – Matemática','external',null,'Reforço escolar fundamental e médio.'),
      ('aulas','English with Paula','resident','D','Inglês para crianças e adultos. Bloco D.'),
      ('aulas','Aulas de violão com Tiago','external',null,'Violão e ukulele para iniciantes.'),
      ('aulas','Reforço escolar Sônia','external',null,'Alfabetização e acompanhamento de tarefas.'),

      ('marmita','Marmitas da Dona Lúcia','resident','B','Comida caseira, pedidos até as 10h. Bloco B.'),
      ('marmita','Doces da Bia','external',null,'Bolos, brigadeiros e doces para festas.'),
      ('marmita','Salgados do Edu','external',null,'Salgadinhos para festa, cento e meio cento.'),
      ('marmita','Fit Marmitas Carol','external',null,'Marmitas fit, semanais ou mensais.'),

      ('tecnico','TI em Casa','external',null,'Formatação, notebook lento e rede Wi-Fi.'),
      ('tecnico','Celular Express','external',null,'Troca de tela e bateria na hora.'),
      ('tecnico','Wi-Fi Fácil','resident','C','Instalação de roteadores e câmeras. Bloco C.'),

      ('chaveiro','Chaveiro 24h Valter','external',null,'Abertura de portas e troca de fechaduras.'),
      ('chaveiro','Chaves & Cia','external',null,'Cópias de chave e chaves tetra.'),
      ('chaveiro','Claudinho Chaveiro','external',null,'Atendimento rápido, orçamento por WhatsApp.'),

      ('mudanca','Fretes Rápidos Souza','external',null,'Carreto e mudanças pequenas, com ajudantes.'),
      ('mudanca','Carreto do Márcio','external',null,'Fretes na região, com ou sem montador.'),
      ('mudanca','Mudanças Brasil','external',null,'Mudança completa, embalagem e seguro.'),

      ('outros','Dedetizadora Livre de Pragas','external',null,'Dedetização, cupins e caixa d''água.'),
      ('outros','Costureira Dona Nair','resident','A','Ajustes de roupa e cortinas. Bloco A.'),
      ('outros','Fotógrafo Gabriel','external',null,'Ensaios, festas e fotos de família.')
    ) as t(cat, nm, kd, blk, ds)
  loop
    i := i + 1;
    v_creator := v_user_ids[1 + (i % array_length(v_user_ids, 1))];
    insert into public.providers (condo_id, category_id, created_by, name, description, whatsapp, kind, block, created_at)
    values (v_condo, (select id from public.categories where slug = p.cat), v_creator, p.nm, p.ds,
            '55119000' || lpad(i::text, 5, '0'), p.kd, p.blk,
            now() - interval '2 days' - (random() * 58 || ' days')::interval);
  end loop;

  -- avaliações: 0 a 5 por prestador, de vizinhos diferentes
  for p in select id from public.providers where created_by = any (v_user_ids) loop
    v_n := floor(random() * 6)::int;
    for r in select uid from unnest(v_user_ids) as uid order by random() limit v_n loop
      v_x := random();
      v_rating := case when v_x < 0.50 then 5 when v_x < 0.80 then 4 when v_x < 0.93 then 3 else 2 end;
      v_comment := case v_rating
        when 5 then c5[1 + floor(random() * array_length(c5, 1))::int]
        when 4 then c4[1 + floor(random() * array_length(c4, 1))::int]
        when 3 then c3[1 + floor(random() * array_length(c3, 1))::int]
        else c2[1 + floor(random() * array_length(c2, 1))::int] end;
      insert into public.reviews (condo_id, provider_id, author_id, author_label, rating, comment, created_at)
      values (v_condo, p.id, r.uid, '', v_rating, v_comment, now() - (random() * 30 || ' days')::interval);
    end loop;
  end loop;

  raise notice 'Pronto: % prestadores e % avaliações de teste.',
    (select count(*) from public.providers where created_by = any (v_user_ids)),
    (select count(*) from public.reviews where author_id = any (v_user_ids));
end $$;
