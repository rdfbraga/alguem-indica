-- Grupos de categorias + lista ampliada (casa, saúde, profissionais, família, pets, beleza, comida/festas, carro/tech).
-- Idempotente: preserva ids e slugs existentes (prestadores continuam nas mesmas categorias).
create table if not exists public.category_groups (
  id serial primary key,
  slug text not null unique,
  name text not null,
  icon text not null default '📁',
  sort int not null default 100
);
alter table public.category_groups enable row level security;
drop policy if exists category_groups_read on public.category_groups;
create policy category_groups_read on public.category_groups for select to authenticated using (true);
grant select on public.category_groups to authenticated;

alter table public.categories add column if not exists group_id int references public.category_groups(id);

insert into public.category_groups (slug, name, icon, sort) values
  ('casa','Casa e reformas','🏠',10),
  ('saude','Saúde','🩺',20),
  ('profissionais','Profissionais e consultoria','⚖️',30),
  ('familia','Família e educação','👶',40),
  ('pets','Pets','🐶',50),
  ('beleza','Beleza e estética','💅',60),
  ('comida','Comida e festas','🍽️',70),
  ('carro','Carro, tech e outros','🚗',80)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, sort = excluded.sort;

insert into public.categories (slug, name, icon, sort, keywords, group_id)
select v.slug, v.name, v.icon, v.sort, v.keywords, g.id
from (values
  ('casa','diarista','Diarista / Limpeza','🧹',10,'faxina faxineira limpeza domestica passadeira passar roupa'),
  ('casa','encanador','Encanador','🚰',20,'bombeiro hidraulico vazamento cano torneira desentupidora esgoto caixa dagua'),
  ('casa','eletricista','Eletricista','💡',30,'luz tomada fiacao chuveiro disjuntor lampada instalacao eletrica'),
  ('casa','pintor','Pintor','🎨',40,'pintura parede textura massa corrida reforma'),
  ('casa','marceneiro','Marceneiro','🪚',50,'moveis armario carpinteiro planejados madeira montador'),
  ('casa','pedreiro','Pedreiro / Reformas','🧱',60,'obra reforma azulejo piso alvenaria reboco construcao'),
  ('casa','gesseiro','Gesseiro / Forro','🏗️',70,'gesso drywall forro sanca moldura'),
  ('casa','vidraceiro','Vidraceiro / Serralheiro','🪟',80,'vidro box espelho janela grade portao solda ferro aluminio esquadria'),
  ('casa','ar-condicionado','Ar-condicionado','❄️',90,'ar condicionado split refrigeracao instalacao limpeza manutencao'),
  ('casa','chaveiro','Chaveiro','🔑',100,'chave fechadura abertura porta copia'),
  ('casa','dedetizacao','Dedetização','🐜',110,'praga barata cupim rato formiga mosquito desinsetizacao'),
  ('casa','jardinagem','Jardinagem','🌱',120,'jardim planta grama poda paisagismo vaso'),
  ('casa','montador','Montador de móveis','🛠️',130,'montagem moveis guarda roupa cama instalar prateleira suporte tv'),
  ('saude','medico','Médico(a)','🩺',10,'doutor clinico geral pediatra ginecologista dermatologista ortopedista cardiologista oftalmologista urologista endocrinologista neurologista psiquiatra otorrino consulta especialista'),
  ('saude','dentista','Dentista','🦷',20,'odontologia ortodontia aparelho clareamento canal implante'),
  ('saude','psicologo','Psicólogo(a)','🧠',30,'terapia terapeuta psicoterapia ansiedade casal'),
  ('saude','nutricionista','Nutricionista','🥗',40,'dieta nutricao emagrecimento alimentacao reeducacao'),
  ('saude','fisioterapeuta','Fisioterapeuta','🦴',50,'fisio reabilitacao coluna rpg quiropraxia osteopata'),
  ('saude','fonoaudiologo','Fonoaudiólogo(a)','🗣️',60,'fono fala linguagem voz audicao'),
  ('saude','cuidador','Cuidador(a) de idosos','🧓',70,'idoso enfermeira enfermagem tecnica acompanhante curativo home care'),
  ('profissionais','advogado','Advogado(a)','⚖️',10,'direito juridico trabalhista familia divorcio inventario imobiliario consumidor previdenciario contrato processo'),
  ('profissionais','contador','Contador(a)','🧾',20,'contabilidade imposto de renda mei declaracao abertura empresa'),
  ('profissionais','arquiteto','Arquiteto(a) / Engenheiro(a)','📐',30,'arquitetura projeto engenharia decoracao design de interiores planta laudo'),
  ('profissionais','corretor','Corretor de imóveis','🏘️',40,'imobiliaria venda aluguel locacao apartamento avaliacao'),
  ('profissionais','despachante','Despachante','📄',50,'documento detran licenciamento transferencia veiculo cartorio'),
  ('familia','baba','Babá','🧸',10,'cuidadora crianca bebe nanny'),
  ('familia','aulas','Aulas particulares','📚',20,'professor reforco explicador matematica alfabetizacao'),
  ('familia','idiomas','Idiomas e música','🎸',30,'ingles espanhol violao piano canto aula de musica'),
  ('familia','escolinha','Escolinha esportiva','⚽',40,'futebol natacao judo ballet tenis ginastica crianca'),
  ('familia','personal','Personal trainer / Pilates','💪',50,'treino academia musculacao pilates yoga funcional professor'),
  ('pets','passeador','Passeador / Pet sitter','🐕',10,'cachorro cao pet dog walker gato hospedagem'),
  ('pets','veterinario','Veterinário(a)','🐾',20,'vet clinica animal vacina cachorro gato'),
  ('pets','banho-tosa','Banho e tosa','🛁',30,'tosa pet shop banho cachorro gato'),
  ('pets','adestrador','Adestrador(a)','🦮',40,'adestramento comportamento cachorro treino'),
  ('beleza','manicure','Manicure','💅',10,'unha esmalte gel alongamento pedicure'),
  ('beleza','cabeleireiro','Cabeleireiro(a)','💇',20,'cabelo corte escova coloracao progressiva'),
  ('beleza','barbeiro','Barbeiro','💈',30,'barba corte masculino cabelo'),
  ('beleza','maquiador','Maquiador(a)','💄',40,'maquiagem make noiva festa'),
  ('beleza','depilacao','Depilação / Estética','🌸',50,'sobrancelha cilios design limpeza de pele estetica'),
  ('beleza','massagista','Massagista','💆',60,'massagem relaxante terapeutica drenagem'),
  ('comida','marmita','Marmitas','🍱',10,'comida almoco quentinha caseira fit'),
  ('comida','doces','Doces e bolos','🎂',20,'bolo brigadeiro confeitaria torta festa'),
  ('comida','salgados','Salgados','🥟',30,'salgadinho coxinha festa cento'),
  ('comida','buffet','Buffet / Chef em casa','👨‍🍳',40,'chef cozinheiro jantar churrasco festa evento'),
  ('comida','fotografo','Fotógrafo(a)','📸',50,'foto video ensaio festa evento familia'),
  ('comida','decoracao','Decoração / Festas','🎈',60,'festa aniversario balao decoracao infantil'),
  ('carro','mecanico','Mecânico','🔧',10,'carro oficina revisao freio motor moto'),
  ('carro','lava-jato','Lava-jato','🚗',20,'lavagem estetica automotiva polimento higienizacao carro'),
  ('carro','tecnico','Técnico (TV, PC, celular)','🖥️',30,'televisao tv computador notebook celular conserto informatica'),
  ('carro','redes','Redes / Wi-Fi / Câmeras','📡',40,'wifi internet roteador camera seguranca cftv interfone'),
  ('carro','mudanca','Mudança / Frete','🚚',50,'frete carreto transporte caminhao mudanca'),
  ('carro','outros','Outros','✨',999,'')
) as v(grp, slug, name, icon, sort, keywords)
join public.category_groups g on g.slug = v.grp
on conflict (slug) do update
  set name = excluded.name, icon = excluded.icon, sort = excluded.sort,
      keywords = excluded.keywords, group_id = excluded.group_id;

-- Categorias criadas pelo admin antes dos grupos ficam no último grupo.
update public.categories set group_id = (select id from public.category_groups where slug = 'carro')
where group_id is null;

-- Aprovação de categoria sugerida agora também escolhe o grupo.
drop function if exists public.approve_category(uuid, text, text, uuid[]);
create or replace function public.approve_category(p_condo uuid, p_name text, p_icon text, p_group_id int, p_provider_ids uuid[])
returns text
language plpgsql security definer set search_path = public as $$
declare v_slug text; v_base text; v_id int; n int := 1;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  p_name := trim(p_name);
  if char_length(p_name) not between 2 and 40 then raise exception 'nome da categoria inválido'; end if;
  p_icon := coalesce(nullif(trim(p_icon), ''), '✨');
  if char_length(p_icon) > 8 then raise exception 'ícone inválido'; end if;
  if not exists (select 1 from public.category_groups where id = p_group_id) then raise exception 'grupo inválido'; end if;

  v_base := trim(both '-' from regexp_replace(lower(unaccent(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then raise exception 'nome da categoria inválido'; end if;
  v_slug := v_base;
  while exists (select 1 from public.categories where slug = v_slug) loop
    n := n + 1; v_slug := v_base || '-' || n;
  end loop;

  insert into public.categories (slug, name, icon, sort, group_id)
  values (v_slug, p_name, p_icon, 500, p_group_id) returning id into v_id;

  update public.providers set category_id = v_id, custom_category = null, custom_category_reviewed = false
   where condo_id = p_condo and id = any (p_provider_ids);
  return v_slug;
end $$;
grant execute on function public.approve_category(uuid, text, text, int, uuid[]) to authenticated;
