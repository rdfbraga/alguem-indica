-- Contato dos moradores com a administração: suporte, problemas e sugestões.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('suporte','problema','sugestao','outro')),
  message text not null check (char_length(message) between 5 and 1000),
  reply_to text check (reply_to is null or char_length(reply_to) <= 120),  -- como o morador prefere ser contatado (opcional)
  status text not null default 'new' check (status in ('new','answered','archived')),
  admin_reply text check (admin_reply is null or char_length(admin_reply) <= 1000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists feedback_condo_status_idx on public.feedback (condo_id, status, created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);

-- Limite: 5 mensagens por morador a cada 24h.
create or replace function public.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.feedback where user_id = new.user_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  new.status := 'new';
  new.admin_reply := null;
  new.replied_at := null;
  return new;
end $$;
drop trigger if exists feedback_before_insert on public.feedback;
create trigger feedback_before_insert before insert on public.feedback
  for each row execute function public.feedback_before_insert();

alter table public.feedback enable row level security;
drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.is_admin(condo_id));
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (public.is_member(condo_id) and user_id = auth.uid());
drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback for update to authenticated
  using (public.is_admin(condo_id)) with check (public.is_admin(condo_id));

grant select, insert, update on public.feedback to authenticated;
