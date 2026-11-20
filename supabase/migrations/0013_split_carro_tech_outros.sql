-- Divide o grupo "Carro, tech e outros" em três: Serviços automotivos, Serviços de tecnologia e Outros serviços.
-- Os prestadores já cadastrados NÃO mudam de categoria: as categorias existentes só trocam de grupo
-- (e "Redes / Wi-Fi / Câmeras" passa a "Redes e Wi-Fi", ganhando uma categoria própria para câmeras).
-- Idempotente. NÃO rode de novo a 0005 depois desta (ela devolveria as categorias ao grupo antigo).

-- 1) o grupo antigo (slug "carro") vira "Serviços automotivos"; nascem os outros dois
update public.category_groups set name = 'Serviços automotivos', icon = '🚗', sort = 80 where slug = 'carro';
insert into public.category_groups (slug, name, icon, sort) values
  ('tecnologia', 'Serviços de tecnologia', '💻', 90),
  ('outros-servicos', 'Outros serviços', '🧩', 100)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, sort = excluded.sort;

-- 2) categorias (as existentes mantêm id e slug; as novas são criadas)
insert into public.categories (slug, name, icon, sort, keywords, group_id)
select v.slug, v.name, v.icon, v.sort, v.keywords, g.id
from (values
  ('carro','mecanico','Mecânico','🔧',10,'carro oficina revisao freio motor suspensao troca de oleo moto motocicleta'),
  ('carro','funilaria','Funilaria e pintura','🚙',20,'amassado pintura lataria martelinho de ouro polimento reparo batida'),
  ('carro','auto-eletrica','Auto elétrica','⚡',30,'bateria alternador farol vidro eletrico injecao eletrica carro scanner'),
  ('carro','borracharia','Pneus e borracharia','🛞',40,'pneu alinhamento balanceamento calibragem furo roda'),
  ('carro','guincho','Guincho e reboque','🚨',50,'reboque socorro pane carro quebrado plataforma resgate'),
  ('carro','lava-jato','Lava-jato','🚗',60,'lavagem estetica automotiva polimento higienizacao vitrificacao carro'),
  ('carro','som-insulfilm','Som e insulfilm','🔊',70,'insulfilm som multimidia alarme acessorios multimidia tapete'),
  ('tecnologia','computador','Computador e notebook','💻',10,'pc notebook formatacao lento virus upgrade ssd manutencao informatica'),
  ('tecnologia','celular','Celular e tablet','📱',20,'troca de tela bateria conserto iphone android tablet smartphone'),
  ('tecnologia','tv-som','TV, som e antena','📺',30,'televisao tv instalacao suporte antena home theater soundbar parabolica'),
  ('tecnologia','redes','Redes e Wi-Fi','📡',40,'wifi internet roteador repetidor cabeamento rede sinal'),
  ('tecnologia','cameras','Câmeras e alarmes','📹',50,'camera seguranca cftv alarme cerca eletrica interfone portao eletronico'),
  ('tecnologia','automacao','Automação residencial','🤖',60,'casa inteligente alexa sensor smart tomada inteligente iluminacao automatica'),
  ('tecnologia','sites','Sites, apps e marketing digital','🌐',70,'site loja virtual aplicativo social media design grafico trafego pago logo'),
  ('tecnologia','tecnico','Assistência técnica geral','🖥️',80,'televisao tv computador notebook celular conserto informatica eletronicos'),
  ('outros-servicos','mudanca','Mudança / Frete','🚚',10,'frete carreto transporte caminhao mudanca'),
  ('outros-servicos','entregas','Entregas e motoboy','🛵',20,'motoboy entrega delivery moto encomenda documentos'),
  ('outros-servicos','motorista','Motorista particular','🚖',30,'transfer aeroporto motorista corrida viagem particular'),
  ('outros-servicos','costura','Costura e ajustes','🧵',40,'costureira barra ajuste conserto roupa cortina bordado'),
  ('outros-servicos','sapateiro','Sapateiro e consertos','👞',50,'sapato calcado bolsa mala conserto sola'),
  ('outros-servicos','traducao','Tradução e revisão','🌍',60,'tradutor traducao juramentada revisao texto ingles documentos'),
  ('outros-servicos','lavanderia','Lavanderia e tinturaria','🧺',70,'lavar a seco edredom tapete tinturaria cobertor'),
  ('outros-servicos','outros','Outros','✨',999,'')
) as v(grp, slug, name, icon, sort, keywords)
join public.category_groups g on g.slug = v.grp
on conflict (slug) do update
  set name = excluded.name, icon = excluded.icon, sort = excluded.sort,
      keywords = excluded.keywords, group_id = excluded.group_id;
