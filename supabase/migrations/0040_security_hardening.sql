-- Endurecimento de segurança (auditoria). Idempotente. Depende de 0001, 0010, 0021, 0036 e 0038.
--  1) Liberar plano, cancelar plano e confirmar pagamento: só o administrador da PLATAFORMA (antes: qualquer admin de condomínio).
--  2) O cliente não define dono do perfil nem resposta do dono ao inserir direto pela API.
--  3) Teste grátis: um por pessoa e por WhatsApp (antes: um por perfil).
--  4) Avaliação do próprio perfil é recusada.
--  5) Storage: limite de tamanho e tipo; anúncios só na pasta do próprio admin; URLs de imagem precisam ser do nosso Storage.
-- Os triggers só atuam quando há usuário logado (auth.uid() não nulo): scripts rodados no SQL Editor não são afetados.

-- ───────── 1) Dinheiro: só a plataforma libera plano ─────────
create or replace function public.grant_plan(p_provider uuid, p_days int, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_condo uuid;
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  select condo_id into v_condo from public.providers where id = p_provider;
  if v_condo is null then raise exception 'perfil inválido'; end if;
  if p_days is null or p_days < 1 or p_days > 366 then raise exception 'dias inválidos'; end if;
  insert into public.provider_plans (provider_id, condo_id, source, current_period_end, note)
  values (p_provider, v_condo, 'manual', now() + make_interval(days => p_days), nullif(left(trim(coalesce(p_note, '')), 200), ''))
  on conflict (provider_id) do update
    set current_period_end = greatest(now(), coalesce(public.provider_plans.current_period_end, now())) + make_interval(days => p_days),
        source = case when public.provider_plans.source = 'trial' then 'manual' else public.provider_plans.source end,
        note = coalesce(nullif(left(trim(coalesce(p_note, '')), 200), ''), public.provider_plans.note),
        updated_at = now();
end $$;
grant execute on function public.grant_plan(uuid, int, text) to authenticated;

create or replace function public.cancel_plan(p_provider uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
  update public.provider_plans set current_period_end = now(), updated_at = now() where provider_id = p_provider;
end $$;
grant execute on function public.cancel_plan(uuid) to authenticated;

create or replace function public.admin_decide_payment(p_condo uuid, p_id uuid, p_confirm boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v public.plan_payments;
begin
  if not public.is_platform_admin() then raise exception 'apenas o administrador da plataforma'; end if;
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

-- Os pedidos de pagamento pendentes e a receita só interessam a quem confirma.
create or replace function public.admin_pending_payments(p_condo uuid)
returns table (id uuid, provider_id uuid, provider_name text, months int, amount_cents int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pp.id, pp.provider_id, p.name, pp.months, pp.amount_cents, pp.created_at
    from public.plan_payments pp join public.providers p on p.id = pp.provider_id
   where public.is_platform_admin() and pp.condo_id = p_condo and pp.status = 'pending' order by pp.created_at;
$$;
grant execute on function public.admin_pending_payments(uuid) to authenticated;

-- ───────── 2) Cliente não define posse nem resposta do dono ─────────
create or replace function public.providers_lock_client_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.owner_id := null;       -- virar dono só pelo pedido de posse (aprovado pelo admin)
    new.owner_since := null;
    new.hours_text := null;     -- horários fazem parte da vitrine (save_showcase)
  end if;
  return new;
end $$;
drop trigger if exists providers_lock_client_fields_trg on public.providers;
create trigger providers_lock_client_fields_trg before insert on public.providers
  for each row execute function public.providers_lock_client_fields();

-- ───────── 4) Avaliação: sem resposta do dono embutida e sem avaliar o próprio perfil ─────────
create or replace function public.reviews_lock_client_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.providers;
begin
  if auth.uid() is not null then
    new.reply_text := null;
    new.reply_at := null;
    select * into p from public.providers where id = new.provider_id;
    if p.id is not null and (p.created_by = new.author_id or p.owner_id = new.author_id) then
      raise exception 'self_review';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists reviews_lock_client_fields_trg on public.reviews;
create trigger reviews_lock_client_fields_trg before insert on public.reviews
  for each row execute function public.reviews_lock_client_fields();

-- ───────── 3) Teste grátis: um por pessoa e por WhatsApp ─────────
create or replace function public.start_trial(p_provider uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.providers; pl public.provider_plans;
begin
  select * into p from public.providers where id = p_provider;
  if p.id is null then raise exception 'perfil inválido'; end if;
  if p.owner_id is distinct from auth.uid() then raise exception 'not_owner'; end if;
  if not public.feature_enabled(p.condo_id, 'plans') then raise exception 'plans_off'; end if;
  select * into pl from public.provider_plans where provider_id = p_provider;
  if pl.provider_id is not null and pl.trial_used then raise exception 'trial_used'; end if;
  -- a mesma pessoa, ou o mesmo WhatsApp, já usou o teste em outro perfil
  if exists (select 1 from public.provider_plans x join public.providers q on q.id = x.provider_id
              where x.trial_used and q.id <> p_provider and (q.owner_id = auth.uid() or q.whatsapp = p.whatsapp)) then
    raise exception 'trial_used';
  end if;
  if public.plan_is_active(p_provider) then raise exception 'already_active'; end if;
  insert into public.provider_plans (provider_id, condo_id, source, trial_used, current_period_end)
  values (p_provider, p.condo_id, 'trial', true, now() + interval '30 days')
  on conflict (provider_id) do update
    set source = 'trial', trial_used = true, current_period_end = now() + interval '30 days', updated_at = now();
end $$;
grant execute on function public.start_trial(uuid) to authenticated;

-- ───────── 5) Storage ─────────
update storage.buckets
   set file_size_limit = 2097152,                                     -- 2 MB (o app já reduz a foto para ~800 px)
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id in ('provider-photos', 'ad-images');

-- Imagem de anúncio: só administrador, e só na própria pasta.
drop policy if exists ad_images_upload on storage.objects;
create policy ad_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-images'
              and (storage.foldername(name))[1] = auth.uid()::text
              and (public.is_platform_admin()
                   or exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'admin')));

-- Endereços de imagem precisam apontar para o Storage do projeto (NOT VALID: só vale para dados novos; os antigos já seguem o padrão).
alter table public.providers drop constraint if exists providers_photo_url_storage;
alter table public.providers add constraint providers_photo_url_storage
  check (photo_url is null or photo_url ~ '^https://[^/?#]+/storage/v1/object/public/provider-photos/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') not valid;
alter table public.provider_photos drop constraint if exists provider_photos_url_storage;
alter table public.provider_photos add constraint provider_photos_url_storage
  check (url ~ '^https://[^/?#]+/storage/v1/object/public/provider-photos/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') not valid;
alter table public.ads drop constraint if exists ads_image_url_storage;
alter table public.ads add constraint ads_image_url_storage
  check (image_url is null or image_url ~ '^https://[^/?#]+/storage/v1/object/public/ad-images/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') not valid;
