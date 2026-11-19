# Indikaí 🏢

Indicações de prestadores de serviço **dentro do seu condomínio**: moradores cadastram e avaliam profissionais, e os vizinhos chamam no WhatsApp com um toque. Multi-condomínio desde o dia 1 (um link por condomínio).

**Stack:** Next.js 16 (App Router) · Supabase (Auth + Postgres + Storage, com RLS) · Tailwind 4 · Vercel.

## O que o MVP faz

- Login por **link no e-mail** ou **Google** (sem senha). No 1º acesso: nome, bloco/torre, unidade e aceite dos termos.
- **Sem verificação de moradia** no MVP (decisão consciente — ver “Próximos passos”).
- Home com **grade de categorias + busca**.
- Qualquer morador logado **indica um profissional** (morador ou externo): nome, categoria, descrição, foto, WhatsApp. Publica na hora.
- **Detecção de duplicidade**: WhatsApp igual é bloqueado (leva ao perfil existente); nome parecido na mesma categoria, ou muitos cadastros do mesmo morador em 24h, **sinalizam** o item na fila do admin.
- Perfil com botão **“Chamar no WhatsApp”** (`wa.me` com mensagem pronta), média e avaliações.
- **Avaliação 1–5 + comentário**, uma por morador por prestador, exibindo “Maria S. · Bloco B”.
- **Denunciar** prestador/avaliação; **painel admin** (`/c/<slug>/admin`) com fila de suspeitos, denúncias, ocultar/reexibir.
- Páginas de **Termos** e **Privacidade (LGPD)** — modelos iniciais; revise com um advogado.

## Como rodar

1. **Supabase**: crie um projeto em supabase.com.
2. No **SQL Editor**, rode nesta ordem: `supabase/migrations/0001_init.sql` e depois `supabase/seed.sql` (categorias + um condomínio de exemplo, `meu-condominio`; edite slug/nome).
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
```sql
insert into public.condominiums (slug, name) values ('residencial-xyz', 'Residencial XYZ');
```
O link do novo condomínio é `/c/residencial-xyz`. Os dados são totalmente isolados por RLS.

## Testes

```bash
npm run typecheck
npm test        # normalização de telefone
```
A migration e as policies de RLS foram verificadas contra Postgres 16 (isolamento entre condomínios, anti-escalação de admin, duplicidade, avaliação única).

## Próximos passos sugeridos

- **Verificação leve**: código de acesso por condomínio (ou convite por vizinho) — o schema já permite adicionar uma coluna em `condominiums`.
- Subdomínio por condomínio (`xyz.indikai.com.br`) em vez de `/c/<slug>`.
- Assumir perfil pelo prestador (código no WhatsApp) → assinatura/selo “Recomendado”.
- Editar/excluir a própria indicação e a própria conta (LGPD).
- Avisos por e-mail ao admin; banners de comércios locais; agendamento.
