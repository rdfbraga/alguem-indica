-- Nova categoria "Faz tudo / Marido de aluguel" no grupo "Casa e reformas". Idempotente.
insert into public.categories (slug, name, icon, sort, keywords, group_id)
select 'faz-tudo', 'Faz tudo / Marido de aluguel', '🧰', 5,
  'marido de aluguel pequenos reparos conserto manutencao geral biscate handyman servicos gerais instalar prateleira cortina quadro',
  g.id
from public.category_groups g where g.slug = 'casa'
on conflict (slug) do update set name = excluded.name, icon = excluded.icon,
  keywords = excluded.keywords, group_id = excluded.group_id;
