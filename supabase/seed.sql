-- Primeiro condomínio (ajuste o slug e o nome; o slug vira o link /c/<slug>).
-- As categorias e grupos vêm da migration 0005_category_groups.sql.
insert into public.condominiums (slug, name)
values ('meu-condominio', 'Meu Condomínio')
on conflict (slug) do nothing;
