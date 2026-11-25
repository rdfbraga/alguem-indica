-- Cobrança do plano Destaque por Pix (manual por enquanto): o dono pede para assinar, paga, e a administração confirma.
-- O valor e a chave Pix ficam em configurações da plataforma (editáveis só pelo administrador da plataforma). Idempotente.

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;   -- sem policies: só as funções abaixo
revoke all on public.platform_settings from anon, authenticated;
insert into public.platform_settings (key, value) values
  ('plan_price_cents', '2900'), ('plan_quarter_discount_pct', '15'), ('pix_key', ''), ('pix_holder', ''), ('billing_whatsapp', '')
on conflict (key) do nothing;

-- O que o prestador precisa para pagar (só leitura).
create or replace function public.billing_info() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'price_cents', coalesce((select value::int from public.platform_settings where key = 'plan_price_cents'), 2900),
    'quarter_discount_pct', coalesce((select value::int from public.platform_settings where key = 'plan_quarter_discount_pct'), 15),
    'pix_key', coalesce((select value from public.platform_settings where key = 'pix_key'), ''),
    'pix_holder', coalesce((select value from public.platform_settings where key = 'pix_holder'), ''),
    'billing_whatsapp', coalesce((select value from public.platform_settings where key = 'billing_whatsapp'), '')) end;
$$;
grant execute on function public.billing_info() to authenticated;

create or replace function public.platform_set_billing(p_price_cents int, p_discount_pct int, p_pix_key text, p_pix_holder text, p_whatsapp text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  if p_price_cents is null or p_price_cents not between 100 and 100000 then raise exception 'preco_invalido'; end if;
  if p_discount_pct is null or p_discount_pct not between 0 and 50 then raise exception 'desconto_invalido'; end if;
  p_pix_key := left(trim(coalesce(p_pix_key, '')), 120);
  p_pix_holder := left(trim(coalesce(p_pix_holder, '')), 80);
  p_whatsapp := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if p_whatsapp <> '' and p_whatsapp !~ '^55[0-9]{10,11}$' then raise exception 'whatsapp_invalido'; end if;
  insert into public.platform_settings (key, value) values
    ('plan_price_cents', p_price_cents::text), ('plan_quarter_discount_pct', p_discount_pct::text),
    ('pix_key', p_pix_key), ('pix_holder', p_pix_holder), ('billing_whatsapp', p_whatsapp)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
grant execute on function public.platform_set_billing(int, int, text, text, text) to authenticated;

-- Pagamentos do plano
create table if not exists public.plan_payments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  months int not null check (months in (1, 3)),
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);
create index if not exists plan_payments_provider_idx on public.plan_payments (provider_id, created_at desc);
create index if not exists plan_payments_condo_idx on public.plan_payments (condo_id, status, created_at desc);
alter table public.plan_payments enable row level security;   -- sem policies: só as funções abaixo
revoke all on public.plan_payments from anon, authenticated;

create or replace function public.plan_amount_cents(p_months int) returns int
language sql stable security definer set search_path = public as $$
  select case when p_months = 3
    then round(price * 3 * (100 - disc) / 100.0)::int
    else price end
  from (select coalesce((select value::int from public.platform_settings where key = 'plan_price_cents'), 2900) as price,
               coalesce((select value::int from public.platform_settings where key = 'plan_quarter_discount_pct'), 15) as disc) s;
$$;

-- O dono do perfil pede para assinar (1 ou 3 meses). Se já há um pedido aguardando, devolve o mesmo.
create or replace function public.request_plan_payment(p_provider uuid, p_months int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.providers; v public.plan_payments;
begin
  if auth.uid() is null then raise exception 'sem permissão'; end if;
  if p_months not in (1, 3) then raise exception 'meses_invalidos'; end if;
  select * into p from public.providers where id = p_provider;
  if p.id is null or p.owner_id is distinct from auth.uid() then raise exception 'not_owner'; end if;
  if not public.feature_enabled(p.condo_id, 'plans') then raise exception 'plans_off'; end if;
  select * into v from public.plan_payments where provider_id = p_provider and status = 'pending' order by created_at desc limit 1;
  if v.id is not null and v.months = p_months then
    return jsonb_build_object('id', v.id, 'amount_cents', v.amount_cents, 'months', v.months);
  end if;
  if v.id is not null then
    update public.plan_payments set status = 'rejected', decided_at = now() where id = v.id;   -- trocou de opção: o anterior perde a validade
  end if;
  insert into public.plan_payments (provider_id, condo_id, user_id, months, amount_cents)
  values (p_provider, p.condo_id, auth.uid(), p_months, public.plan_amount_cents(p_months)) returning * into v;
  return jsonb_build_object('id', v.id, 'amount_cents', v.amount_cents, 'months', v.months);
end $$;
grant execute on function public.request_plan_payment(uuid, int) to authenticated;

-- O dono vê o pedido aguardando (se houver).
create or replace function public.my_pending_payment(p_provider uuid)
returns table (id uuid, months int, amount_cents int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pp.id, pp.months, pp.amount_cents, pp.created_at from public.plan_payments pp
   join public.providers p on p.id = pp.provider_id
   where pp.provider_id = p_provider and pp.status = 'pending' and p.owner_id = auth.uid()
   order by pp.created_at desc limit 1;
$$;
grant execute on function public.my_pending_payment(uuid) to authenticated;

-- Administração: pagamentos aguardando confirmação e a decisão.
create or replace function public.admin_pending_payments(p_condo uuid)
returns table (id uuid, provider_id uuid, provider_name text, months int, amount_cents int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pp.id, pp.provider_id, p.name, pp.months, pp.amount_cents, pp.created_at
    from public.plan_payments pp join public.providers p on p.id = pp.provider_id
   where public.is_admin(p_condo) and pp.condo_id = p_condo and pp.status = 'pending' order by pp.created_at;
$$;
grant execute on function public.admin_pending_payments(uuid) to authenticated;

create or replace function public.admin_decide_payment(p_condo uuid, p_id uuid, p_confirm boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v public.plan_payments;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  select * into v from public.plan_payments where id = p_id and condo_id = p_condo for update;
  if v.id is null or v.status <> 'pending' then raise exception 'pedido não encontrado'; end if;
  update public.plan_payments set status = case when p_confirm then 'confirmed' else 'rejected' end, decided_at = now(), decided_by = auth.uid() where id = p_id;
  if p_confirm then
    insert into public.provider_plans (provider_id, condo_id, source, current_period_end)
    values (v.provider_id, v.condo_id, 'payment', now() + make_interval(months => v.months))
    on conflict (provider_id) do update
      set current_period_end = greatest(now(), coalesce(public.provider_plans.current_period_end, now())) + make_interval(months => v.months),
          source = 'payment', updated_at = now();
  end if;
end $$;
grant execute on function public.admin_decide_payment(uuid, uuid, boolean) to authenticated;

-- Receita confirmada no período (para o Monitorar).
create or replace function public.admin_payment_summary(p_condo uuid, p_days int default 30)
returns table (payments bigint, total_cents bigint)
language sql stable security definer set search_path = public as $$
  select count(*), coalesce(sum(amount_cents), 0)::bigint from public.plan_payments
   where public.is_admin(p_condo) and condo_id = p_condo and status = 'confirmed'
     and decided_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
$$;
grant execute on function public.admin_payment_summary(uuid, int) to authenticated;
