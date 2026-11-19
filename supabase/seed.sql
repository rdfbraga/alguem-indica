-- Categorias iniciais
insert into public.categories (slug, name, icon, sort, keywords) values
  ('diarista','Diarista / Limpeza','🧹',10,'faxina faxineira limpeza domestica passadeira passar roupa'),
  ('encanador','Encanador','🚰',20,'bombeiro hidraulico vazamento cano torneira desentupidora esgoto caixa dagua'),
  ('eletricista','Eletricista','💡',30,'luz tomada fiacao chuveiro disjuntor lampada instalacao eletrica'),
  ('pintor','Pintor','🎨',40,'pintura parede textura massa corrida reforma'),
  ('marceneiro','Marceneiro','🪚',50,'moveis armario carpinteiro planejados madeira montador'),
  ('ar-condicionado','Ar-condicionado','❄️',60,'ar condicionado split refrigeracao instalacao limpeza manutencao'),
  ('baba','Babá','🧸',70,'cuidadora crianca bebe nanny'),
  ('personal','Personal trainer','💪',80,'treino academia musculacao pilates yoga funcional professor'),
  ('passeador','Passeador de cães / Pet','🐶',90,'cachorro cao pet dog walker veterinario banho tosa gato'),
  ('manicure','Manicure / Estética','💅',100,'unha sobrancelha depilacao estetica massagem cilios design'),
  ('cabeleireiro','Cabeleireiro(a)','💇',110,'cabelo corte barbeiro escova coloracao barba'),
  ('aulas','Aulas particulares','📚',120,'professor reforco ingles musica explicador matematica'),
  ('marmita','Marmitas / Doces / Salgados','🍱',130,'comida bolo doce salgado festa confeitaria quentinha almoco'),
  ('tecnico','Técnico (TV, PC, celular)','🖥️',140,'televisao tv computador notebook celular wifi internet informatica conserto'),
  ('chaveiro','Chaveiro','🔑',150,'chave fechadura abertura porta copia'),
  ('mudanca','Mudança / Frete','🚚',160,'frete carreto transporte caminhao montador'),
  ('outros','Outros','✨',999,'')
on conflict (slug) do nothing;

-- Primeiro condomínio (ajuste o slug e o nome; o slug vira o link /c/<slug>)
insert into public.condominiums (slug, name)
values ('meu-condominio', 'Meu Condomínio')
on conflict (slug) do nothing;
