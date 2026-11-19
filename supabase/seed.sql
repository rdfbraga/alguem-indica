-- Categorias iniciais
insert into public.categories (slug, name, icon, sort) values
  ('diarista','Diarista / Limpeza','🧹',10),
  ('encanador','Encanador','🚰',20),
  ('eletricista','Eletricista','💡',30),
  ('pintor','Pintor','🎨',40),
  ('marceneiro','Marceneiro','🪚',50),
  ('ar-condicionado','Ar-condicionado','❄️',60),
  ('baba','Babá','🧸',70),
  ('personal','Personal trainer','💪',80),
  ('passeador','Passeador de cães / Pet','🐶',90),
  ('manicure','Manicure / Estética','💅',100),
  ('cabeleireiro','Cabeleireiro(a)','💇',110),
  ('aulas','Aulas particulares','📚',120),
  ('marmita','Marmitas / Doces / Salgados','🍱',130),
  ('tecnico','Técnico (TV, PC, celular)','🖥️',140),
  ('chaveiro','Chaveiro','🔑',150),
  ('mudanca','Mudança / Frete','🚚',160),
  ('outros','Outros','✨',999)
on conflict (slug) do nothing;

-- Primeiro condomínio (ajuste o slug e o nome; o slug vira o link /c/<slug>)
insert into public.condominiums (slug, name)
values ('meu-condominio', 'Meu Condomínio')
on conflict (slug) do nothing;
