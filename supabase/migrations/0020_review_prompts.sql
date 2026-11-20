-- "Como foi?": depois que o morador toca em "Chamar no WhatsApp", a tela inicial pergunta se ele quer avaliar.
-- Aparece entre 1 e 14 dias depois do contato, só se ele ainda não avaliou nem dispensou. Idempotente.

create table if not exists public.review_prompt_dismissed (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);
alter table public.review_prompt_dismissed enable row level security;   -- sem policies: só as funções abaixo
revoke all on public.review_prompt_dismissed from anon, authenticated;

create or replace function public.review_prompts(p_condo uuid)
returns table (provider_id uuid, name text, category_name text, category_icon text, contacted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.provider_id, p.name, c.name, c.icon, x.contacted_at
    from (select e.provider_id, max(e.created_at) as contacted_at
            from public.provider_events e
           where e.user_id = auth.uid() and e.condo_id = p_condo and e.kind = 'whatsapp'
             and e.created_at <= now() - interval '1 day' and e.created_at > now() - interval '14 days'
           group by e.provider_id) x
    join public.providers p on p.id = x.provider_id and p.status = 'active' and p.condo_id = p_condo
    join public.categories c on c.id = p.category_id
   where public.is_member(p_condo)
     and p.owner_id is distinct from auth.uid()
     and not exists (select 1 from public.reviews r where r.provider_id = x.provider_id and r.author_id = auth.uid())
     and not exists (select 1 from public.review_prompt_dismissed d where d.provider_id = x.provider_id and d.user_id = auth.uid())
   order by x.contacted_at desc
   limit 2;
$$;
grant execute on function public.review_prompts(uuid) to authenticated;

create or replace function public.dismiss_review_prompt(p_provider uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.review_prompt_dismissed (user_id, provider_id)
  select auth.uid(), p_provider where auth.uid() is not null and exists (select 1 from public.providers where id = p_provider)
  on conflict do nothing;
$$;
grant execute on function public.dismiss_review_prompt(uuid) to authenticated;
