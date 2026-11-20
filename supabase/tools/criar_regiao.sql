-- Agrupa condomínios vizinhos numa REGIÃO: eles passam a compartilhar a base de prestadores e de avaliações.
-- (Moradores, administradores, avisos, anúncios e chaves continuam separados por condomínio.)
-- Requer a migration 0021_regions.sql. Edite os slugs abaixo e rode no SQL Editor. Pode rodar de novo.

-- 1) a região
insert into public.regions (slug, name) values ('parque-barueri', 'Parque Barueri e vizinhança')
on conflict (slug) do update set name = excluded.name;

-- 2) quais condomínios entram (use os slugs dos links /c/<slug>)
update public.condominiums
   set region_id = (select id from public.regions where slug = 'parque-barueri')
 where slug in ('parque-barueri', 'condominio-vizinho-1', 'condominio-vizinho-2');

-- 3) conferência
select r.name as regiao, c.slug, c.name from public.condominiums c join public.regions r on r.id = c.region_id order by r.name, c.name;

-- Para tirar um condomínio da região:  update public.condominiums set region_id = null where slug = '...';
-- Se dois condomínios já tinham o MESMO WhatsApp cadastrado, o app não apaga nada: os perfis duplicados continuam
-- existindo (um em cada). Resolva pela tela de Duplicidades ou ocultando um deles.
