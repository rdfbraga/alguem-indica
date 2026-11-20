# Alguém Indica 🏢

Indicações de prestadores de serviço **dentro do seu condomínio**: moradores cadastram e avaliam profissionais, e os vizinhos chamam no WhatsApp com um toque. Multi-condomínio desde o dia 1 (um link por condomínio).

**Stack:** Next.js 16 (App Router) · Supabase (Auth + Postgres + Storage, com RLS) · Tailwind 4 · Vercel.

## O que o MVP faz

- Login por **link no e-mail** ou **Google** (sem senha). No 1º acesso: nome, bloco/torre, unidade e aceite dos termos.
- **Sem verificação de moradia** no MVP (decisão consciente — ver “Próximos passos”).
- Home com **categorias em grupos recolhíveis** (Casa, Saúde, Profissionais, Família, Pets, Beleza, Comida e festas, Carro/tech), **busca inteligente** (sem acento, tolera erros de digitação e entende sinônimos como “bombeiro hidráulico” → Encanador) e destaques: **mais bem avaliados** e **indicações recentes**.
- Listas com **ordenação** (melhor avaliados, mais avaliados, mais recentes) e **filtro** morador/externo. “Melhor avaliados” usa média ponderada: 1 avaliação nota 5 não passa por cima de 20 avaliações com 4,8.
- **Resultados:** visitas e cliques no WhatsApp/Instagram/site, em `/c/<slug>/resultados` (dono do perfil) e na visão geral do admin. Só totais; ninguém vê quem foi.
- **Instagram e site** no perfil (grátis), com cliques medidos.
- **Recursos para monetizar, prontos e desligados** (Admin → Funcionalidades, por condomínio): **plano Destaque** (30 dias de teste grátis pelo próprio dono, ou concedido pelo admin), **vitrine** (serviços com preços, horários e até 6 fotos), **respostas públicas às avaliações** e **anunciantes locais** na home, com relatório de exibições e cliques. Sem pagamento automático: o admin concede e cancela o plano manualmente.
- **Especialidades** dentro de algumas categorias (Médico → Pediatra, Dermatologista…; Advogado → Trabalhista, Família…), sem multiplicar categorias. Filtro na página da categoria, etiquetas no perfil e busca que acha só quem tem a especialidade. O admin gerencia a lista em **Admin → Especialidades** (criar, editar, excluir e aprovar o que os moradores escrevem em “Outra especialidade”).
- **App instalável (PWA)**: o morador instala o ícone na tela inicial. Há um manifesto por condomínio (abre direto no condomínio), convite de instalação na home (botão no Android; passo a passo no iPhone) e uma tela “sem conexão”. O service worker não guarda dados nem páginas.
- **Cadastro do próprio serviço** (só moradores): o perfil entra no ar na hora como “cadastrado pelo próprio · aguardando confirmação”, e o admin confirma. Prestador de fora é indicado por um vizinho e depois assume o perfil. Se o WhatsApp já existe, o app pergunta “É você?”.
- **Posse de perfil:** o prestador pede “Este perfil é meu”, o admin aprova com um clique e ele passa a ser o único (com o admin) a editar nome, telefone, descrição, foto e categorias. O perfil ganha o selo “confirmado pelo próprio”.
- Um profissional pode atender **até 3 categorias** no mesmo perfil (a primeira é a principal); só quem indicou ou o admin edita.
- Qualquer morador logado **indica um profissional** (morador ou externo): nome, categoria, descrição, foto, WhatsApp. Publica na hora.
- **Detecção de duplicidade**: WhatsApp igual é bloqueado (leva ao perfil existente); nome parecido na mesma categoria, ou muitos cadastros do mesmo morador em 24h, **sinalizam** o item na fila do admin.
- Perfil com botão **“Chamar no WhatsApp”** (`wa.me` com mensagem pronta), média e avaliações.
- **Avaliação 1–5 + comentário**, uma por morador por prestador, exibindo “Maria S. · Bloco B”.
- **Ajuda** (`/c/<slug>/ajuda`): o morador envia suporte, problema ou sugestão e vê a resposta da administração na própria página (limite de 5 mensagens por dia).
- **Denunciar** prestador/avaliação; **painel admin** (`/c/<slug>/admin`) com fila de suspeitos, denúncias, ocultar/reexibir.
- Páginas de **Termos** e **Privacidade (LGPD)** — modelos iniciais; revise com um advogado.

## Como rodar

1. **Supabase**: crie um projeto em supabase.com.
2. No **SQL Editor**, rode nesta ordem: `supabase/migrations/0001_init.sql`, `0002_grants.sql`, `0003_search.sql`, `0004_custom_category.sql`, `0005_category_groups.sql` (grupos e ~50 categorias), `0006_feedback.sql` (contato com a administração), `0007_multi_category.sql` (um perfil em até 3 categorias), `0008_profile_ownership.sql` (posse de perfil), `0009_metrics_and_links.sql` (medição, Instagram e site), `0010_premium_features.sql` (plano Destaque, vitrine, respostas e anúncios — tudo desligado), `0011_self_registered.sql` (rótulo de perfil cadastrado pelo próprio), `0012_specialties.sql` (especialidades dentro das categorias), `0013_split_carro_tech_outros.sql` (divide o último grupo em Serviços automotivos, de tecnologia e Outros serviços), `0014_specialty_admin.sql` (painel de especialidades do Admin), `0015_faz_tudo.sql` (categoria Faz tudo / Marido de aluguel), `0016_category_admin.sql` (painel de categorias do Admin), `0017_content_flags.sql` (triagem automática de conteúdo suspeito), `0018_review_content_flags.sql` (triagem dos comentários de avaliação), `0019_growth_stats.sql` (indicadores de crescimento em Admin → Monitorar), `0020_review_prompts.sql` (convite "Como foi?" para avaliar depois do contato), `0023_admin_provider_clicks.sql` (cliques na aba Perfis), `0025_platform_admins_manage.sql` (promover e rebaixar administradores de cada condomínio), `0024_platform_admin.sql` (administrador da plataforma: cria condomínios e regiões; defina quem é com `supabase/tools/definir_admin_plataforma.sql`), `0022_admin_overview.sql` (visão unificada dos condomínios que você administra), `0021_regions.sql` (região: condomínios vizinhos compartilham prestadores e avaliações; use `supabase/tools/criar_regiao.sql`) e depois `supabase/seed.sql` (um condomínio de exemplo, `meu-condominio`; edite slug/nome). Em um projeto já em uso, rode só as migrations que faltam.
3. **Authentication → Providers**: e-mail já vem ativo; ative **Google** se quiser (precisa de Client ID/Secret do Google Cloud).
4. **Authentication → URL Configuration**: em *Site URL* coloque a URL do app e em *Redirect URLs* adicione `http://localhost:3000/auth/callback` e `https://SEU-DOMINIO/auth/callback`.
5. Copie `.env.example` para `.env.local` e preencha URL e anon key (Project Settings → API).
6. ```bash
   npm install
   npm run dev
   ```
   Abra `http://localhost:3000/c/meu-condominio`.
7. **Torne-se admin**: entre uma vez no app e conclua o cadastro; depois, no SQL Editor:
   ```sql
   update public.members set role = 'admin'
   where user_id = (select id from auth.users where email = 'seu@email.com');
   ```
8. **Deploy**: importe o repositório na Vercel e defina as 3 variáveis de ambiente do `.env.example`.

### Adicionar outro condomínio
Use `supabase/tools/novo_condominio.sql`: edite o slug, o nome e o e-mail do administrador e rode no SQL Editor. O link do novo condomínio é `/c/<slug>`; os dados são totalmente isolados por RLS.
