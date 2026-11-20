-- Especialidades: etiquetas dentro de uma categoria (Médico → Pediatra, Dermatologista…), sem criar categorias novas.
-- Corrige a busca: antes, as palavras de especialidade estavam na CATEGORIA e "pediatra" devolvia todos os médicos.

create table if not exists public.specialties (
  id serial primary key,
  category_id int not null references public.categories(id) on delete cascade,
  slug text not null,
  name text not null check (char_length(name) between 2 and 60),
  keywords text not null default '',
  sort int not null default 100,
  unique (category_id, slug)
);
alter table public.specialties enable row level security;
drop policy if exists specialties_read on public.specialties;
create policy specialties_read on public.specialties for select to authenticated using (true);
grant select on public.specialties to authenticated;

create table if not exists public.provider_specialties (
  provider_id uuid not null references public.providers(id) on delete cascade,
  specialty_id int not null references public.specialties(id) on delete cascade,
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  primary key (provider_id, specialty_id)
);
create index if not exists provider_specialties_spec_idx on public.provider_specialties (specialty_id, condo_id);
alter table public.provider_specialties enable row level security;
drop policy if exists provider_specialties_read on public.provider_specialties;
create policy provider_specialties_read on public.provider_specialties for select to authenticated using (public.is_member(condo_id));
grant select on public.provider_specialties to authenticated;

-- Texto livre para uma especialidade que ainda não está na lista (aparece como etiqueta e entra na busca).
alter table public.providers add column if not exists custom_specialty text
  check (custom_specialty is null or char_length(custom_specialty) between 2 and 40);

-- Define as especialidades do perfil (até 5). Cada uma precisa ser de uma das categorias do perfil.
create or replace function public.set_provider_specialties(p_provider uuid, p_specialty_ids int[], p_custom text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare ids int[]; v_condo uuid; v_custom text := nullif(trim(coalesce(p_custom, '')), '');
begin
  if not public.can_edit_provider(p_provider) then raise exception 'sem permissão'; end if;
  select array_agg(distinct x) into ids from unnest(coalesce(p_specialty_ids, '{}'::int[])) x where x is not null;
  ids := coalesce(ids, '{}'::int[]);
  if cardinality(ids) > 5 then raise exception 'max_specialties'; end if;
  if v_custom is not null and char_length(v_custom) not between 2 and 40 then raise exception 'especialidade inválida'; end if;
  select condo_id into v_condo from public.providers where id = p_provider;
  if exists (select 1 from unnest(ids) x
              where not exists (select 1 from public.specialties s
                                  join public.provider_categories pc on pc.category_id = s.category_id and pc.provider_id = p_provider
                                 where s.id = x)) then
    raise exception 'especialidade fora das categorias do perfil';
  end if;
  delete from public.provider_specialties where provider_id = p_provider and specialty_id <> all (ids);
  insert into public.provider_specialties (provider_id, specialty_id, condo_id)
    select p_provider, x, v_condo from unnest(ids) x on conflict do nothing;
  update public.providers set custom_specialty = v_custom where id = p_provider;
end $$;
grant execute on function public.set_provider_specialties(uuid, int[], text) to authenticated;

-- Trocar as categorias do perfil também tira as especialidades das categorias que saíram.
create or replace function public.set_provider_categories(p_provider uuid, p_category_ids int[], p_custom text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare ids int[]; v_condo uuid; v_other int; v_custom text;
begin
  if not public.can_edit_provider(p_provider) then raise exception 'sem permissão'; end if;
  select array_agg(x order by ord) into ids
    from (select distinct on (x) x, ord from unnest(p_category_ids) with ordinality as t(x, ord) where x is not null order by x, ord) d;
  select array_agg(x order by ord) into ids
    from (select x, ord from unnest(ids) with ordinality as t(x, ord)) s;
  if ids is null or cardinality(ids) not between 1 and 3 then raise exception 'escolha de 1 a 3 categorias'; end if;
  if (select count(*) from public.categories where id = any (ids)) <> cardinality(ids) then raise exception 'categoria inválida'; end if;

  select condo_id into v_condo from public.providers where id = p_provider;
  select id into v_other from public.categories where slug = 'outros';
  v_custom := nullif(trim(coalesce(p_custom, '')), '');
  if v_other = any (ids) then
    if v_custom is null or char_length(v_custom) not between 2 and 40 then raise exception 'custom_required'; end if;
  else
    v_custom := null;
  end if;

  delete from public.provider_categories where provider_id = p_provider and category_id <> all (ids);
  insert into public.provider_categories (provider_id, category_id, condo_id)
    select p_provider, c, v_condo from unnest(ids) c on conflict do nothing;
  update public.providers
     set category_id = ids[1],
         custom_category = v_custom,
         custom_category_reviewed = case when v_custom is distinct from custom_category then false else custom_category_reviewed end
   where id = p_provider;
  delete from public.provider_specialties ps using public.specialties s
   where ps.provider_id = p_provider and s.id = ps.specialty_id and s.category_id <> all (ids);
end $$;
grant execute on function public.set_provider_categories(uuid, int[], text) to authenticated;

-- Vocabulário inicial (pode crescer: basta inserir novas linhas em public.specialties).
insert into public.specialties (category_id, slug, name, keywords, sort)
select c.id, v.slug, v.name, v.kw, v.sort
from (values
  ('medico','clinico-geral','Clínico geral','clinico geral check-up checkup',10),
  ('medico','pediatra','Pediatra','pediatria crianca bebe infantil',20),
  ('medico','ginecologista-obstetra','Ginecologista / Obstetra','ginecologia obstetricia gravidez pre-natal parto mulher',30),
  ('medico','dermatologista','Dermatologista','dermatologia pele acne manchas',40),
  ('medico','ortopedista','Ortopedista','ortopedia osso coluna joelho ombro fratura',50),
  ('medico','cardiologista','Cardiologista','cardiologia coracao pressao',60),
  ('medico','oftalmologista','Oftalmologista','oftalmologia olho vista grau',70),
  ('medico','otorrinolaringologista','Otorrinolaringologista','otorrino ouvido garganta nariz sinusite',80),
  ('medico','urologista','Urologista','urologia próstata prostata',90),
  ('medico','endocrinologista','Endocrinologista','endocrinologia diabetes tireoide hormonio',100),
  ('medico','neurologista','Neurologista','neurologia cabeca enxaqueca',110),
  ('medico','psiquiatra','Psiquiatra','psiquiatria depressao ansiedade',120),
  ('medico','gastroenterologista','Gastroenterologista','gastro estomago intestino',130),
  ('medico','alergista-imunologista','Alergista / Imunologista','alergia imunologia asma rinite',140),
  ('medico','geriatra','Geriatra','idoso terceira idade',150),
  ('medico','pneumologista','Pneumologista','pulmao respiratorio',160),
  ('medico','reumatologista','Reumatologista','reumatologia artrite',170),
  ('medico','nutrologo','Nutrólogo','nutrologia',180),
  ('medico','mastologista','Mastologista','mama mastologia',190),
  ('medico','cirurgiao-plastico','Cirurgião plástico','cirurgia plastica estetica',200),
  ('medico','medico-do-trabalho','Médico do trabalho','medicina do trabalho ocupacional',210),
  ('medico','medicina-esportiva','Medicina esportiva','esporte atleta',220),
  ('medico','homeopata','Homeopata','homeopatia',230),
  ('medico','acupunturista','Acupunturista','acupuntura',240),
  ('dentista','clinico-geral','Clínico geral','clinico geral limpeza restauracao',10),
  ('dentista','ortodontista','Ortodontista','aparelho ortodontia',20),
  ('dentista','implantodontista','Implantodontista','implante',30),
  ('dentista','endodontista','Endodontista','canal tratamento de canal',40),
  ('dentista','odontopediatra','Odontopediatra','odontopediatria crianca infantil',50),
  ('dentista','periodontista','Periodontista','gengiva periodontia',60),
  ('dentista','estetica-dental','Estética dental','clareamento lente facetas',70),
  ('dentista','cirurgiao-bucomaxilofacial','Cirurgião bucomaxilofacial','siso cirurgia',80),
  ('dentista','protese-dentaria','Prótese dentária','protese dentadura',90),
  ('psicologo','psicologia-clinica-adultos','Psicologia clínica (adultos)','adulto terapia',10),
  ('psicologo','infantil-e-adolescentes','Infantil e adolescentes','crianca adolescente',20),
  ('psicologo','casal-e-familia','Casal e família','casal familia',30),
  ('psicologo','neuropsicologia','Neuropsicologia','neuropsicologia avaliacao',40),
  ('psicologo','terapia-cognitivo-comportamental','Terapia cognitivo-comportamental','tcc cognitivo comportamental',50),
  ('psicologo','psicanalise','Psicanálise','psicanalise',60),
  ('psicologo','orientacao-vocacional','Orientação vocacional','vocacional carreira',70),
  ('fisioterapeuta','ortopedica-e-esportiva','Ortopédica e esportiva','ortopedia esporte lesao',10),
  ('fisioterapeuta','neurologica','Neurológica','neurologia avc',20),
  ('fisioterapeuta','respiratoria','Respiratória','respiratoria pulmao',30),
  ('fisioterapeuta','pelvica','Pélvica','pelvica assoalho pelvico',40),
  ('fisioterapeuta','geriatrica','Geriátrica','idoso',50),
  ('fisioterapeuta','pediatrica','Pediátrica','crianca bebe',60),
  ('fisioterapeuta','rpg-e-pilates-clinico','RPG e Pilates clínico','rpg pilates postura',70),
  ('nutricionista','clinica','Clínica','clinica doenca',10),
  ('nutricionista','esportiva','Esportiva','esporte ganho de massa',20),
  ('nutricionista','infantil-e-materno-infantil','Infantil e materno-infantil','crianca gestante',30),
  ('nutricionista','emagrecimento','Emagrecimento','dieta emagrecer obesidade',40),
  ('nutricionista','vegetariana-e-vegana','Vegetariana e vegana','vegetariano vegano',50),
  ('advogado','trabalhista','Trabalhista','trabalho demissao fgts',10),
  ('advogado','familia-e-sucessoes','Família e sucessões','familia divorcio pensao inventario guarda',20),
  ('advogado','imobiliario','Imobiliário','imovel aluguel compra venda locacao',30),
  ('advogado','consumidor','Consumidor','consumidor procon',40),
  ('advogado','previdenciario','Previdenciário','inss aposentadoria beneficio',50),
  ('advogado','criminal','Criminal','penal',60),
  ('advogado','civil-e-contratos','Civil e contratos','civil contrato indenizacao',70),
  ('advogado','empresarial','Empresarial','empresa societario',80),
  ('advogado','tributario','Tributário','imposto tributo',90),
  ('advogado','condominial','Condominial','condominio',100),
  ('advogado','transito','Trânsito','multa transito cnh',110),
  ('advogado','digital-e-lgpd','Digital e LGPD','lgpd digital internet',120),
  ('arquiteto','arquitetura-residencial','Arquitetura residencial','casa apartamento projeto',10),
  ('arquiteto','interiores-e-decoracao','Interiores e decoração','interiores decoracao design',20),
  ('arquiteto','engenharia-civil-e-obras','Engenharia civil e obras','obra engenharia civil',30),
  ('arquiteto','laudos-e-vistorias','Laudos e vistorias','laudo vistoria',40),
  ('arquiteto','paisagismo','Paisagismo','paisagismo jardim',50),
  ('arquiteto','regularizacao-e-aprovacao','Regularização e aprovação','regularizacao prefeitura alvara',60),
  ('aulas','matematica','Matemática','matematica',10),
  ('aulas','portugues-e-redacao','Português e redação','portugues redacao',20),
  ('aulas','fisica-e-quimica','Física e Química','fisica quimica',30),
  ('aulas','biologia-historia-e-geografia','Biologia, História e Geografia','biologia historia geografia',40),
  ('aulas','alfabetizacao','Alfabetização','alfabetizacao leitura',50),
  ('aulas','vestibular-e-enem','Vestibular e ENEM','vestibular enem',60),
  ('aulas','concursos','Concursos','concurso',70),
  ('aulas','informatica','Informática','informatica computador',80),
  ('aulas','reforco-escolar','Reforço escolar','reforco',90),
  ('idiomas','ingles','Inglês','ingles',10),
  ('idiomas','espanhol','Espanhol','espanhol',20),
  ('idiomas','frances','Francês','frances',30),
  ('idiomas','violao','Violão','violao',40),
  ('idiomas','piano-e-teclado','Piano e teclado','piano teclado',50),
  ('idiomas','canto','Canto','canto',60),
  ('idiomas','bateria','Bateria','bateria',70),
  ('idiomas','guitarra-e-baixo','Guitarra e baixo','guitarra baixo',80),
  ('personal','musculacao','Musculação','musculacao academia',10),
  ('personal','funcional','Funcional','funcional',20),
  ('personal','pilates','Pilates','pilates',30),
  ('personal','yoga','Yoga','yoga',40),
  ('personal','corrida','Corrida','corrida',50),
  ('personal','emagrecimento','Emagrecimento','emagrecer',60),
  ('personal','idosos','Idosos','idoso terceira idade',70),
  ('personal','gestantes','Gestantes','gestante',80),
  ('veterinario','clinico-geral','Clínico geral','clinico geral',10),
  ('veterinario','felinos','Felinos','gato felino',20),
  ('veterinario','animais-exoticos','Animais exóticos','exotico silvestre passaro',30),
  ('veterinario','dermatologia-veterinaria','Dermatologia veterinária','pele',40),
  ('veterinario','ortopedia-veterinaria','Ortopedia veterinária','ortopedia',50),
  ('veterinario','cardiologia-veterinaria','Cardiologia veterinária','coracao',60),
  ('veterinario','acupuntura-e-homeopatia','Acupuntura e homeopatia','acupuntura homeopatia',70)
) as v(cat, slug, name, kw, sort)
join public.categories c on c.slug = v.cat
on conflict (category_id, slug) do update set name = excluded.name, keywords = excluded.keywords, sort = excluded.sort;

-- Palavras-chave da CATEGORIA ficam só com termos gerais (as de especialidade agora moram na especialidade).
update public.categories c set keywords = v.k
from (values
  ('medico','doutor doutora consulta consultorio clinica'),
  ('dentista','odontologia dente dentista'),
  ('psicologo','terapia terapeuta psicoterapia'),
  ('fisioterapeuta','fisio reabilitacao'),
  ('advogado','direito juridico processo contrato'),
  ('arquiteto','arquitetura engenharia projeto planta'),
  ('aulas','professor reforco explicador aula'),
  ('personal','treino academia professor'),
  ('idiomas','aula curso professor')
) as v(slug, k)
where c.slug = v.slug;

-- Busca: especialidade (1,0) pesa mais que categoria (0,8); "pediatra" passa a achar só quem é pediatra.
create or replace function public.search_provider_ids(p_condo uuid, p_q text)
returns table (id uuid, score real)
language sql stable set search_path = public as $$
  with toks as (
    select t from unnest(string_to_array(
      regexp_replace(lower(unaccent(trim(coalesce(p_q, '')))), '[%_\\]', '', 'g'), ' ')) as t
    where char_length(t) >= 2
  ), docs as (
    select p.id,
           lower(unaccent(p.name)) as n,
           lower(unaccent(p.description)) as d,
           lower(unaccent(coalesce((select string_agg(c.name || ' ' || c.keywords, ' ')
                                      from provider_categories pc join categories c on c.id = pc.category_id
                                     where pc.provider_id = p.id), '') || ' ' || coalesce(p.custom_category, ''))) as c,
           lower(unaccent(coalesce((select string_agg(sp.name || ' ' || sp.keywords, ' ')
                                      from provider_specialties ps join specialties sp on sp.id = ps.specialty_id
                                     where ps.provider_id = p.id), '') || ' ' || coalesce(p.custom_specialty, ''))) as s
    from providers p
    where p.condo_id = p_condo and p.status = 'active'
  )
  select docs.id,
         (select coalesce(avg(greatest(
              case when docs.n like '%' || t || '%' then 1.0 else 0.0 end,
              case when docs.s like '%' || t || '%' then 1.0 else 0.0 end,
              case when docs.c like '%' || t || '%' then 0.8 else 0.0 end,
              case when docs.d like '%' || t || '%' then 0.5 else 0.0 end,
              word_similarity(t, docs.n),
              word_similarity(t, docs.s),
              word_similarity(t, docs.c) * 0.8)), 0) from toks)::real as score
  from docs
  where exists (select 1 from toks)
    and not exists (
      select 1 from toks
      where not (docs.n like '%' || t || '%'
              or docs.s like '%' || t || '%'
              or docs.c like '%' || t || '%'
              or docs.d like '%' || t || '%'
              or word_similarity(t, docs.n) > 0.5
              or word_similarity(t, docs.s) > 0.5
              or word_similarity(t, docs.c) > 0.5))
  order by score desc
  limit 100;
$$;
grant execute on function public.search_provider_ids(uuid, text) to authenticated;

-- A listagem passa a trazer as especialidades do perfil.
drop view if exists public.provider_listing;
create view public.provider_listing with (security_invoker = true) as
select p.*, c.slug as category_slug, c.name as category_name, c.icon as category_icon,
       coalesce(avg(r.rating) filter (where r.status = 'visible'), 0)::numeric(3,2) as avg_rating,
       count(distinct r.id) filter (where r.status = 'visible')::int as review_count,
       (select array_agg(x.category_id order by (x.category_id = p.category_id) desc, x.category_id)
          from public.provider_categories x where x.provider_id = p.id) as category_ids,
       (select array_agg(c2.slug order by (c2.id = p.category_id) desc, c2.sort)
          from public.provider_categories x join public.categories c2 on c2.id = x.category_id where x.provider_id = p.id) as category_slugs,
       (select array_agg(c2.name order by (c2.id = p.category_id) desc, c2.sort)
          from public.provider_categories x join public.categories c2 on c2.id = x.category_id where x.provider_id = p.id) as category_names,
       public.plan_is_active(p.id) as plan_active,
       public.provider_self_pending(p.id) as self_pending,
       (select array_agg(sp.id order by sp.sort, sp.name) from public.provider_specialties ps
          join public.specialties sp on sp.id = ps.specialty_id where ps.provider_id = p.id) as specialty_ids,
       (select array_agg(sp.slug order by sp.sort, sp.name) from public.provider_specialties ps
          join public.specialties sp on sp.id = ps.specialty_id where ps.provider_id = p.id) as specialty_slugs,
       (select array_agg(sp.name order by sp.sort, sp.name) from public.provider_specialties ps
          join public.specialties sp on sp.id = ps.specialty_id where ps.provider_id = p.id) as specialty_names
from public.providers p
join public.categories c on c.id = p.category_id
left join public.reviews r on r.provider_id = p.id
group by p.id, c.id;
grant select on public.provider_listing to authenticated;
