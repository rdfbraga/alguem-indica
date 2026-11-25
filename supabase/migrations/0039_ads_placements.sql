-- Anúncios em mais lugares: tela inicial, dentro de categorias e nos resultados de busca; e anúncio da REGIÃO (aparece em todos os
-- condomínios dela). Anúncio da região só o administrador da plataforma cria. Depende da 0010, 0021 e 0036. Idempotente.

alter table public.ads add column if not exists scope text not null default 'condo' check (scope in ('condo','region'));
alter table public.ads add column if not exists placements text[] not null default array['home'];
alter table public.ads add column if not exists category_ids int[] not null default '{}';
alter table public.ads add column if not exists keywords text check (keywords is null or char_length(keywords) <= 120);
alter table public.ads drop constraint if exists ads_placements_valid;
alter table public.ads add constraint ads_placements_valid
  check (cardinality(placements) >= 1 and placements <@ array['home','category','search']::text[] and cardinality(category_ids) <= 5);

create or replace function public.ads_validate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- anúncio da região: só o administrador da plataforma cria ou converte, e o condomínio precisa estar numa região
  if new.scope = 'region' and (tg_op = 'INSERT' or old.scope is distinct from new.scope) then
    if not public.is_platform_admin() then raise exception 'regiao_so_plataforma'; end if;
    if not exists (select 1 from public.condominiums where id = new.condo_id and region_id is not null) then raise exception 'sem_regiao'; end if;
  end if;
  -- nos resultados de busca o anúncio precisa de um alvo (categorias ou palavras), senão apareceria em qualquer busca
  if 'search' = any (new.placements) and cardinality(new.category_ids) = 0 and coalesce(trim(new.keywords), '') = '' then
    raise exception 'busca_sem_alvo';
  end if;
  return new;
end $$;
drop trigger if exists ads_validate_trg on public.ads;
create trigger ads_validate_trg before insert or update on public.ads for each row execute function public.ads_validate();

-- Quem vê: moradores do condomínio (anúncio do condomínio) ou da região (anúncio da região); o admin do condomínio vê todos os dele.
drop policy if exists ads_read on public.ads;
create policy ads_read on public.ads for select to authenticated using (
  public.is_admin(condo_id) or (
    active
    and (starts_on is null or starts_on <= (now() at time zone 'America/Sao_Paulo')::date)
    and (ends_on is null or ends_on >= (now() at time zone 'America/Sao_Paulo')::date)
    and (case when scope = 'region' then public.can_view_condo(condo_id) else public.is_member(condo_id) end)));

create or replace function public.log_ad_event(p_ad uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads; v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_kind not in ('view','click') or auth.uid() is null then return; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is null or not a.active or not (case when a.scope = 'region' then public.can_view_condo(a.condo_id) else public.is_member(a.condo_id) end) or not public.feature_enabled(a.condo_id, 'ads') then return; end if;
  if (a.starts_on is not null and a.starts_on > v_today) or (a.ends_on is not null and a.ends_on < v_today) then return; end if;
  if public.is_admin(a.condo_id) then return; end if;   -- o admin testando não entra na conta do anunciante
  if exists (select 1 from public.ad_events where ad_id = p_ad and user_id = auth.uid() and kind = p_kind
              and created_at > now() - (case when p_kind = 'view' then interval '6 hours' else interval '1 minute' end)) then return; end if;
  insert into public.ad_events (ad_id, condo_id, user_id, kind) values (p_ad, a.condo_id, auth.uid(), p_kind);
end $$;
grant execute on function public.log_ad_event(uuid, text) to authenticated;
