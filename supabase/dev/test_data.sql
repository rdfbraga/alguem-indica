-- ============================================================================
-- DADOS DE TESTE do Alguém indica? — rode no SQL Editor do Supabase.
--  * Cria ~170 prestadores (3 a 4 por categoria, nas ~50 categorias) e 15 vizinhos FICTÍCIOS que avaliam.
--  * Requer as migrations 0004, 0005 e 0007 (categorias novas e várias categorias por perfil); com a 0009 também cria visitas, cliques, Instagram e site; com a 0010, perfis com plano/vitrine/respostas e 3 anúncios (as chaves continuam desligadas); com a 0012, especialidades nos médicos, dentistas, advogados etc. Alguns ficam em "Outros" com categoria sugerida.
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
  if not exists (select 1 from public.categories where slug = 'medico') then
    raise exception 'Categorias novas não encontradas. Rode antes a migration 0005_category_groups.sql.';
  end if;

  -- limpa dados de teste anteriores
  delete from public.providers where created_by in (select id from auth.users where email like '%' || v_domain);
  delete from public.reviews   where author_id  in (select id from auth.users where email like '%' || v_domain);
  delete from public.members   where user_id    in (select id from auth.users where email like '%' || v_domain);
  delete from auth.users       where email like '%' || v_domain;
  if to_regclass('public.ads') is not null then delete from public.ads where advertiser like 'Teste · %'; end if;

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
      ('diarista','Cláudia Faxinas','external',null,'Faxina completa e pós-obra. Leva os próprios produtos.',null),
      ('diarista','Rosa Maria','resident','B','Diarista de segunda a sexta. Referências aqui no condomínio.',null),
      ('diarista','Equipe Brilho Limpo','external',null,'Limpeza pesada, vidros e passadoria.',null),
      ('diarista','Nete Passadeira','external',null,'Passo roupa e organizo armários. Busco e entrego no bloco.',null),
      ('encanador','Seu Joaquim Hidráulica','external',null,'Vazamentos, torneiras, registros e caixa d''água.',null),
      ('encanador','Marcos Desentupidora 24h','external',null,'Desentupimento de pias, ralos e esgoto. Atende urgência.',null),
      ('encanador','Paulo Encanador','resident','A','Moro no bloco A. Instalação de chuveiro, pias e vasos.',null),
      ('eletricista','Wagner Elétrica','external',null,'Instalações, quadro de luz e troca de tomadas. Nota fiscal.',null),
      ('eletricista','Eletro Rápido do Zé','external',null,'Chuveiro, ventilador de teto e luminárias.',null),
      ('eletricista','Fábio Instalações','resident','C','Elétrica residencial e iluminação em LED.',null),
      ('eletricista','Ricardo Eletricista','external',null,'Atendimento em até 24h, orçamento sem compromisso.',null),
      ('pintor','Pinturas Silva','external',null,'Pintura de apartamentos, textura e massa corrida.',null),
      ('pintor','Adriano Pintor','external',null,'Acabamento fino e entrega no prazo.',null),
      ('pintor','Cores & Acabamentos','external',null,'Pintura e pequenos reparos em gesso.',null),
      ('marceneiro','Marcenaria Pereira','external',null,'Móveis sob medida, armários e closets.',null),
      ('marceneiro','Jorge Móveis Planejados','external',null,'Cozinhas e dormitórios planejados.',null),
      ('marceneiro','Alê Marceneiro','resident','D','Reparos e montagem de móveis. Moro no bloco D.',null),
      ('pedreiro','Zé Pedreiro Reformas','external',null,'Reformas completas, azulejo e piso. Orçamento grátis.',null),
      ('pedreiro','Construtora Silva & Filhos','external',null,'Obras de pequeno porte e reformas de banheiro e cozinha.',null),
      ('pedreiro','Marcelo Alvenaria','resident','F','Reboco, alvenaria e acabamentos. Bloco F.',null),
      ('gesseiro','Gesso & Forro Pereira','external',null,'Forro de gesso, sancas e molduras.',null),
      ('gesseiro','Rafael Drywall','external',null,'Divisórias e paredes em drywall.',null),
      ('gesseiro','Sanca Perfeita','external',null,'Iluminação embutida em sanca de gesso.',null),
      ('vidraceiro','Vidraçaria Cristal','external',null,'Box de banheiro, espelhos e janelas de vidro.',null),
      ('vidraceiro','Serralheria Ferro Forte','external',null,'Grades, portões e corrimãos sob medida.',null),
      ('vidraceiro','Box & Espelhos Express','resident','G','Troca de box e espelhos em 48h. Bloco G.',null),
      ('ar-condicionado','Frio Certo Refrigeração','external',null,'Instalação, limpeza e manutenção de split.',null),
      ('ar-condicionado','Climatiza Já','external',null,'Higienização de ar-condicionado e carga de gás.',null),
      ('ar-condicionado','Renan Ar Split','resident','B','Instalação de split com garantia. Bloco B.',null),
      ('chaveiro','Chaveiro 24h Valter','external',null,'Abertura de portas e troca de fechaduras.',null),
      ('chaveiro','Chaves & Cia','external',null,'Cópias de chave e chaves tetra.',null),
      ('chaveiro','Claudinho Chaveiro','external',null,'Atendimento rápido, orçamento por WhatsApp.',null),
      ('dedetizacao','Dedetizadora Livre de Pragas','external',null,'Dedetização, cupins e limpeza de caixa d''água.',null),
      ('dedetizacao','Mata Praga 24h','external',null,'Baratas, formigas e ratos. Garantia de 90 dias.',null),
      ('dedetizacao','Cupim Zero','external',null,'Tratamento de cupins em móveis e madeiramento.',null),
      ('jardinagem','Jardins da Rô','external',null,'Manutenção de jardim e plantas de varanda.',null),
      ('jardinagem','Poda & Cia','external',null,'Poda de árvores e corte de grama.',null),
      ('jardinagem','Verde Vida Paisagismo','resident','H','Projetos de paisagismo e hortas em apartamento. Bloco H.',null),
      ('montador','Montador Rápido','external',null,'Montagem de guarda-roupas, camas e estantes.',null),
      ('montador','Móveis Montados Cia','external',null,'Montagem e instalação de prateleiras, TVs e cortinas.',null),
      ('montador','Seu Antônio Montador','resident','D','Montagem de móveis com cuidado. Bloco D.',null),
      ('medico','Dra. Helena Prado – Pediatra','external',null,'Pediatra com consultório no bairro. Atende crianças e adolescentes.',null),
      ('medico','Dr. Ricardo Meirelles – Clínico geral','external',null,'Clínico geral, check-up anual e acompanhamento de doenças crônicas.',null),
      ('medico','Dra. Paula Nogueira – Dermatologista','external',null,'Dermatologia clínica e estética. Atende por convênio e particular.',null),
      ('medico','Dr. André Castro – Ortopedista','resident','E','Ortopedista, coluna e joelho. Moro no bloco E.',null),
      ('dentista','Dra. Camila Rocha Odontologia','external',null,'Clínica geral, limpeza e clareamento.',null),
      ('dentista','Dr. Fábio Sorriso','external',null,'Ortodontia e aparelhos fixos e transparentes.',null),
      ('dentista','Clínica Dental Bem-Estar','external',null,'Implantes, canal e atendimento de urgência.',null),
      ('psicologo','Psi Mariana Alves','external',null,'Psicóloga clínica, terapia individual e de casal. Online ou presencial.',null),
      ('psicologo','Lucas Terapia','resident','C','Psicólogo, adolescentes e adultos. Bloco C.',null),
      ('psicologo','Espaço Mente Leve','external',null,'Terapia cognitivo-comportamental e ansiedade.',null),
      ('nutricionista','Nutri Carolina','external',null,'Reeducação alimentar e emagrecimento saudável.',null),
      ('nutricionista','Nutri Bruno Fit','external',null,'Nutrição esportiva e ganho de massa.',null),
      ('nutricionista','Dra. Patrícia Nutrição','external',null,'Nutrição infantil e materno-infantil.',null),
      ('fisioterapeuta','Fisio Rafael em Casa','external',null,'Fisioterapia domiciliar, reabilitação e RPG.',null),
      ('fisioterapeuta','Fisio & Coluna','external',null,'Tratamento de dores na coluna e postura.',null),
      ('fisioterapeuta','Dra. Beatriz Fisioterapia','resident','A','Pós-operatório e idosos. Bloco A.',null),
      ('fonoaudiologo','Fono Amanda','external',null,'Fonoaudióloga, atraso de fala e linguagem.',null),
      ('fonoaudiologo','Fono Kids','external',null,'Atendimento infantil lúdico.',null),
      ('fonoaudiologo','Fono Renato','external',null,'Voz profissional e audição.',null),
      ('cuidador','Cuidadora Dona Rita','external',null,'Cuidadora de idosos, diurno e noturno.',null),
      ('cuidador','Enfermagem em Casa','external',null,'Técnica de enfermagem: curativos, medicação e acompanhamento.',null),
      ('cuidador','Cuidar Bem Idosos','external',null,'Acompanhamento em consultas e passeios.',null),
      ('advogado','Dra. Júlia Mendonça – Família','external',null,'Direito de família: divórcio, pensão e inventário.',null),
      ('advogado','Dr. Gustavo Lima – Trabalhista','external',null,'Advogado trabalhista, empresas e empregados.',null),
      ('advogado','Dra. Renata Costa – Imobiliário','resident','B','Contratos de aluguel, compra e venda de imóveis. Bloco B.',null),
      ('advogado','Dr. Henrique – Consumidor','external',null,'Direito do consumidor e ações contra empresas.',null),
      ('contador','Contabilidade Souza','external',null,'Contabilidade para MEI e pequenas empresas.',null),
      ('contador','Contador Marcos IR','external',null,'Imposto de renda pessoa física, sem dor de cabeça.',null),
      ('contador','Nova Empresa MEI','external',null,'Abertura de empresa e MEI em 48h.',null),
      ('arquiteto','Arq. Letícia Moreira','resident','D','Projetos de interiores e reformas de apartamentos. Bloco D.',null),
      ('arquiteto','Eng. Roberto Obras','external',null,'Engenheiro civil, laudos e acompanhamento de obras.',null),
      ('arquiteto','Studio Casa Viva','external',null,'Arquitetura e decoração com projeto 3D.',null),
      ('corretor','Corretora Sandra Imóveis','external',null,'Venda e locação de apartamentos no condomínio.',null),
      ('corretor','Corretor Diego','resident','G','Avaliação e venda de imóveis na região. Bloco G.',null),
      ('corretor','Imob. Parque','external',null,'Administração de locação e avaliações.',null),
      ('despachante','Despachante Wilson','external',null,'Transferência de veículos e licenciamento.',null),
      ('despachante','Documenta Fácil','external',null,'Documentos e certidões em cartório.',null),
      ('despachante','Detran Rápido','external',null,'Multas, recursos e CNH.',null),
      ('baba','Tia Bia','resident','A','Babá com 10 anos de experiência. Bloco A.',null),
      ('baba','Juliana Babá','external',null,'Cuidadora de crianças e bebês, com referências.',null),
      ('baba','Dani Cuidadora','external',null,'Folguista para noites e fins de semana.',null),
      ('aulas','Prof. Helena – Matemática','external',null,'Reforço escolar fundamental e médio.',null),
      ('aulas','Reforço escolar Sônia','external',null,'Alfabetização e acompanhamento de tarefas.',null),
      ('aulas','Aulas de redação com Lia','external',null,'Redação para ENEM e vestibulares.',null),
      ('idiomas','English with Paula','resident','D','Inglês para crianças e adultos. Bloco D.',null),
      ('idiomas','Aulas de violão com Tiago','external',null,'Violão e ukulele para iniciantes.',null),
      ('idiomas','Prof. Carla – Espanhol','external',null,'Espanhol conversação e preparação para viagens.',null),
      ('idiomas','Piano com Ana','resident','F','Aulas de piano e teoria musical. Bloco F.',null),
      ('escolinha','Escolinha de Futebol Craques','external',null,'Turmas de 6 a 14 anos, sábado de manhã.',null),
      ('escolinha','Natação Baby Splash','external',null,'Natação para bebês e crianças.',null),
      ('escolinha','Judô com Mestre Kenji','external',null,'Judô e disciplina para crianças.',null),
      ('escolinha','Ballet Pequenas Bailarinas','external',null,'Ballet infantil, turmas a partir de 4 anos.',null),
      ('personal','Prof. Thiago Treinos','resident','C','Personal no condomínio e na academia. Bloco C.',null),
      ('personal','Camila Pilates','external',null,'Pilates solo e funcional em domicílio.',null),
      ('personal','Lucas Funcional ao ar livre','external',null,'Treinos em grupo na área verde, de manhã cedo.',null),
      ('personal','Personal Renata','external',null,'Emagrecimento e condicionamento. Aula experimental grátis.',null),
      ('passeador','Pet Passeio Ana','external',null,'Passeios diários e pet sitter. Envia fotos.',null),
      ('passeador','Dog Walker Caio','resident','E','Passeio de cães com segurança. Moro no bloco E.',null),
      ('passeador','Hotelzinho Patinhas','external',null,'Hospedagem de cães e gatos quando você viaja.',null),
      ('veterinario','Dra. Fernanda Vet','external',null,'Clínica geral veterinária, vacinas e exames.',null),
      ('veterinario','Clínica Amigo Pet','external',null,'Atendimento 24h e emergências.',null),
      ('veterinario','Dr. Roberto Vet Domiciliar','external',null,'Consultas em casa para cães e gatos.',null),
      ('banho-tosa','Banho & Tosa Móvel','external',null,'Vamos até o seu apartamento. Cães e gatos.',null),
      ('banho-tosa','Pet Spa Aurora','external',null,'Banho, tosa higiênica e hidratação.',null),
      ('banho-tosa','Tosa do Max','resident','H','Tosa na raça e banho. Bloco H.',null),
      ('adestrador','Adestra Pet Caio','external',null,'Adestramento básico e correção de comportamento.',null),
      ('adestrador','Cão Educado','external',null,'Aulas em casa para filhotes e adultos.',null),
      ('adestrador','Bom Comportamento Pet','external',null,'Socialização e passeio guiado.',null),
      ('manicure','Manicure Lu','external',null,'Mãos e pés, esmaltação em gel. Atende em casa.',null),
      ('manicure','Studio Priscila Nails','resident','B','Alongamento e nail art. Bloco B.',null),
      ('manicure','Mãos Bonitas Tati','external',null,'Manicure e pedicure com materiais esterilizados.',null),
      ('cabeleireiro','Salão da Márcia','external',null,'Corte, escova e coloração em domicílio.',null),
      ('cabeleireiro','Hair Home Fernanda','external',null,'Progressiva, hidratação e cortes femininos.',null),
      ('cabeleireiro','Studio Ana Cabelos','external',null,'Mechas, luzes e tratamentos.',null),
      ('barbeiro','Barbeiro Léo','resident','A','Corte masculino e barba. Bloco A.',null),
      ('barbeiro','Barbearia do Zé','external',null,'Corte na régua e barba com toalha quente.',null),
      ('barbeiro','Navalha Clássica','external',null,'Barbearia retrô, atende com hora marcada.',null),
      ('maquiador','Make by Isa','external',null,'Maquiagem para festas, formaturas e eventos.',null),
      ('maquiador','Maquiadora Bruna','resident','E','Maquiagem social e aulas de automaquiagem. Bloco E.',null),
      ('maquiador','Noiva Perfeita Make','external',null,'Maquiagem para noivas e madrinhas.',null),
      ('depilacao','Sobrancelhas da Duda','external',null,'Design de sobrancelha, cílios e depilação.',null),
      ('depilacao','Estética Vida','external',null,'Limpeza de pele e tratamentos faciais.',null),
      ('depilacao','Depil Express','external',null,'Depilação com cera e linha, a domicílio.',null),
      ('massagista','Massagem Relax Sônia','external',null,'Massagem relaxante e drenagem linfática.',null),
      ('massagista','Mãos de Fada','external',null,'Massagem terapêutica e quick massage.',null),
      ('massagista','Quiro Massoterapia','external',null,'Massoterapia para dores e tensões.',null),
      ('marmita','Marmitas da Dona Lúcia','resident','B','Comida caseira, pedidos até as 10h. Bloco B.',null),
      ('marmita','Fit Marmitas Carol','external',null,'Marmitas fit, semanais ou mensais.',null),
      ('marmita','Marmita Express do Sérgio','external',null,'Prato feito completo, entrega no bloco.',null),
      ('doces','Doces da Bia','external',null,'Bolos, brigadeiros e doces para festas.',null),
      ('doces','Ateliê da Vovó Bolos','external',null,'Bolos decorados e tortas.',null),
      ('doces','Brigadeiros Gourmet','resident','C','Brigadeiros e docinhos finos. Bloco C.',null),
      ('salgados','Salgados do Edu','external',null,'Salgadinhos para festa, cento e meio cento.',null),
      ('salgados','Coxinha da Lu','external',null,'Coxinhas, pastéis e kibes.',null),
      ('salgados','Festa & Salgados','external',null,'Mini salgados e finger foods.',null),
      ('buffet','Chef Marcelo em Casa','external',null,'Jantares e almoços para eventos em casa.',null),
      ('buffet','Buffet Sabor & Arte','external',null,'Buffet completo para festas e aniversários.',null),
      ('buffet','Churrasco do Gaúcho','external',null,'Churrasqueiro com equipe para eventos.',null),
      ('fotografo','Fotógrafo Gabriel','external',null,'Ensaios, festas e fotos de família.',null),
      ('fotografo','Estúdio Luz & Cia','external',null,'Fotografia infantil e newborn.',null),
      ('fotografo','Foto Família Dani','resident','G','Ensaios de família no condomínio. Bloco G.',null),
      ('decoracao','Festas da Mari','external',null,'Decoração de aniversário infantil.',null),
      ('decoracao','Balões Mágicos','external',null,'Arcos de balões e painéis.',null),
      ('decoracao','Decor Festa Kids','external',null,'Locação de móveis e decoração temática.',null),
      ('mecanico','Oficina do Toninho','external',null,'Revisão, freios e suspensão. Orçamento na hora.',null),
      ('mecanico','Mecânico Pedro Móvel','external',null,'Atendimento mecânico no estacionamento.',null),
      ('mecanico','Auto Center Silva','external',null,'Elétrica, injeção e alinhamento.',null),
      ('lava-jato','Lava Jato Brilho','external',null,'Lavagem completa e polimento.',null),
      ('lava-jato','Estética Automotiva Max','resident','F','Higienização interna e vitrificação. Bloco F.',null),
      ('lava-jato','Lavagem a Seco Ecológica','external',null,'Lavagem no estacionamento, sem usar água.',null),
      ('tecnico','TI em Casa','external',null,'Formatação, notebook lento e rede Wi-Fi.',null),
      ('tecnico','Celular Express','external',null,'Troca de tela e bateria na hora.',null),
      ('tecnico','Técnico de TV Valdir','external',null,'Conserto e instalação de TVs.',null),
      ('redes','Wi-Fi Fácil','resident','C','Instalação de roteadores e câmeras. Bloco C.',null),
      ('redes','Câmeras Seguras','external',null,'Câmeras, alarmes e interfones.',null),
      ('redes','Rede em Dia','external',null,'Cabeamento estruturado e repetidores.',null),
      ('mudanca','Fretes Rápidos Souza','external',null,'Carreto e mudanças pequenas, com ajudantes.',null),
      ('mudanca','Carreto do Márcio','external',null,'Fretes na região, com ou sem montador.',null),
      ('mudanca','Mudanças Brasil','external',null,'Mudança completa, embalagem e seguro.',null),
      ('outros','Costureira Dona Nair','resident','A','Ajustes de roupa e cortinas. Bloco A.','Costureira'),
      ('outros','Costureira Lúcia','external',null,'Barras, ajustes e vestidos sob medida.','costureira'),
      ('outros','Tradutora Sofia','external',null,'Tradução juramentada de documentos.','Tradução')
    ) as t(cat, nm, kd, blk, ds, cc)
  loop
    i := i + 1;
    v_creator := v_user_ids[1 + (i % array_length(v_user_ids, 1))];
    insert into public.providers (condo_id, category_id, created_by, name, description, whatsapp, kind, block, custom_category, created_at)
    values (v_condo, (select id from public.categories where slug = p.cat), v_creator, p.nm, p.ds,
            '55119000' || lpad(i::text, 5, '0'), p.kd, p.blk, p.cc,
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

  -- perfis que atendem mais de uma categoria (até 3): categorias extras além da principal
  insert into public.provider_categories (provider_id, category_id, condo_id)
  select pr.id, c.id, v_condo
    from (values
      ('Paulo Encanador','eletricista'),('Paulo Encanador','pedreiro'),
      ('Fábio Instalações','montador'),('Eletro Rápido do Zé','ar-condicionado'),
      ('Alê Marceneiro','montador'),('Marcelo Alvenaria','pintor'),('Marcelo Alvenaria','gesseiro'),
      ('Seu Joaquim Hidráulica','pedreiro'),('Nete Passadeira','diarista'),
      ('Camila Pilates','fisioterapeuta'),('Dra. Beatriz Fisioterapia','cuidador'),
      ('Barbeiro Léo','cabeleireiro'),('Chef Marcelo em Casa','marmita'),
      ('Wi-Fi Fácil','tecnico'),('Câmeras Seguras','eletricista')
    ) as e(nm, slug)
    join public.providers pr on pr.name = e.nm and pr.created_by = any (v_user_ids)
    join public.categories c on c.slug = e.slug
  on conflict do nothing;

  -- (migration 0009) Instagram/site em alguns perfis e visitas/cliques dos últimos 35 dias, para o painel ter dados
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'providers' and column_name = 'instagram') then
    update public.providers set instagram = 'teste.' || lower(regexp_replace(split_part(name, ' ', 1), '[^A-Za-z]', '', 'g')),
                                website = case when random() < 0.4 then 'https://teste-' || lower(regexp_replace(split_part(name, ' ', 1), '[^A-Za-z]', '', 'g')) || '.com.br' end
     where created_by = any (v_user_ids) and random() < 0.5;
    insert into public.provider_events (provider_id, condo_id, user_id, kind, created_at)
    select pr.id, v_condo,
           v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))::int],
           case when random() < 0.8 then 'view' else 'whatsapp' end,
           now() - (random() * 35 || ' days')::interval
      from public.providers pr
      cross join lateral generate_series(1, (power(random(), 2) * 70)::int + 1) g(n)
     where pr.created_by = any (v_user_ids);
  end if;

  -- (migration 0010) perfis com dono e plano, vitrine, respostas e anúncios — para ver tudo assim que as chaves forem ligadas
  if to_regclass('public.provider_plans') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'providers' and column_name = 'owner_id') then
    create temp table tmp_chosen on commit drop as
      select pr.id, pr.created_by, pr.condo_id, (row_number() over (order by random()))::int as rn
        from public.providers pr where pr.created_by = any (v_user_ids) order by random() limit 14;
    update public.providers pr
       set owner_id = c.created_by, owner_since = now() - interval '10 days',
           hours_text = E'Seg a sex: 8h às 18h\nSáb: 8h às 12h'
      from tmp_chosen c where pr.id = c.id;
    -- ímpares: plano concedido; pares: teste grátis em andamento
    insert into public.provider_plans (provider_id, condo_id, source, trial_used, current_period_end)
      select id, condo_id, case when rn % 2 = 0 then 'trial' else 'manual' end, rn % 2 = 0, now() + ((5 + rn * 2) || ' days')::interval from tmp_chosen;
    insert into public.provider_services (provider_id, condo_id, title, description, price_text, sort)
      select c.id, c.condo_id, s.t, s.d, s.p, s.o
        from tmp_chosen c cross join (values
          ('Visita e orçamento','Sem compromisso','Grátis',0),
          ('Serviço padrão','Mão de obra',null,1),
          ('Serviço completo','Com material incluso','a partir de R$ 150',2)) s(t, d, p, o);
    update public.reviews rv set reply_text = 'Obrigado pela avaliação! Foi um prazer atender.', reply_at = now() - interval '2 days'
     where rv.provider_id in (select id from tmp_chosen) and rv.rating >= 4 and random() < 0.6;
    insert into public.ads (condo_id, advertiser, title, body, link_url, whatsapp, cta_label)
      values (v_condo, 'Teste · Pizzaria Boa', 'Pizza em dobro às terças', 'Peça pelo site ou WhatsApp e ganhe borda recheada.', 'https://exemplo.com.br/pizzaria', null, 'Pedir agora'),
             (v_condo, 'Teste · Pet Feliz', 'Banho e tosa com 20% off', 'Para moradores do condomínio, de segunda a quinta.', null, '5511900000099', 'Chamar no WhatsApp'),
             (v_condo, 'Teste · Academia Vida', 'Primeira semana grátis', null, 'https://exemplo.com.br/academia', null, 'Quero conhecer');
  end if;

  -- (migration 0008) alguns moradores "cadastraram o próprio serviço": pedido de posse pendente do autor (aparece na fila do admin)
  if to_regclass('public.profile_claims') is not null then
    insert into public.profile_claims (condo_id, provider_id, user_id, note)
      select pr.condo_id, pr.id, pr.created_by, 'Cadastrou o próprio perfil'
        from public.providers pr
       where pr.created_by = any (v_user_ids) and pr.owner_id is null and pr.kind = 'resident'
       order by random() limit 5;
  end if;

  -- (migration 0012) especialidades: primeiro as que aparecem no nome/descrição ("Pediatra", "Trabalhista"...),
  -- depois, para ~70% dos que ficaram sem, uma especialidade qualquer da categoria principal
  if to_regclass('public.provider_specialties') is not null then
    insert into public.provider_specialties (provider_id, specialty_id, condo_id)
      select pr.id, sp.id, v_condo
        from public.providers pr
        join public.specialties sp on sp.category_id = pr.category_id
       where pr.created_by = any (v_user_ids)
         and lower(unaccent(pr.name || ' ' || pr.description)) like '%' || lower(unaccent(split_part(sp.name, ' ', 1))) || '%'
      on conflict do nothing;
    insert into public.provider_specialties (provider_id, specialty_id, condo_id)
      select x.pid, x.sid, v_condo
        from (select pr.id as pid, sp.id as sid, row_number() over (partition by pr.id order by random()) as rn
                from public.providers pr join public.specialties sp on sp.category_id = pr.category_id
               where pr.created_by = any (v_user_ids)
                 and not exists (select 1 from public.provider_specialties ps where ps.provider_id = pr.id)) x
       where x.rn = 1 and random() < 0.7
      on conflict do nothing;
  end if;

  raise notice 'Pronto: % prestadores e % avaliações de teste.',
    (select count(*) from public.providers where created_by = any (v_user_ids)),
    (select count(*) from public.reviews where author_id = any (v_user_ids));
end $$;
