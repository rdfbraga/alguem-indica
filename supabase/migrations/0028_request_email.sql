-- Avisar por e-mail quando alguém indicar o que a pessoa pediu ("Os vizinhos estão procurando"). Depende da 0027. Idempotente.
-- O envio é feito pelo servidor do app (precisa de RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY e MAIL_FROM na Vercel).

alter table public.indication_requests add column if not exists notify_email boolean not null default false;
alter table public.indication_requests add column if not exists emailed_at timestamptz;

drop function if exists public.request_indication(uuid, text);
create or replace function public.request_indication(p_condo uuid, p_label text, p_notify boolean default true) returns text
language plpgsql security definer set search_path = public as $$
declare v_label text := regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g'); v_key text; v_cat int; v_flag text; v_status text := 'open';
begin
  if auth.uid() is null or not public.is_member(p_condo) then raise exception 'sem permissão'; end if;
  if char_length(v_label) not between 2 and 60 then raise exception 'texto_invalido'; end if;
  v_key := public.request_norm(v_label);
  if (select count(*) from public.indication_requests where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'limite_diario';
  end if;
  select c.id into v_cat from public.categories c
   where c.slug <> 'outros'
     and (public.request_norm(c.name) = v_key or public.request_norm(split_part(c.name, ' / ', 1)) = v_key
          or (char_length(v_key) >= 5 and public.request_norm(c.name || ' ' || coalesce(c.keywords, '')) like '%' || v_key || '%'))
   order by (public.request_norm(c.name) = v_key) desc, c.sort limit 1;
  if public.request_has_providers(p_condo, v_label, v_cat) then return 'ja_existe'; end if;
  if exists (select 1 from public.indication_requests where user_id = auth.uid() and label_key = v_key and status in ('open','review')) then
    if p_notify then
      update public.indication_requests set notify_email = true
       where user_id = auth.uid() and label_key = v_key and status in ('open','review') and not notify_email;
    end if;
    return 'ja_pediu';
  end if;
  v_flag := public.content_flags(null, v_label, null, null);
  if v_flag is not null then v_status := 'review'; end if;
  insert into public.indication_requests (condo_id, user_id, label, label_key, category_id, status, flag_reason, notify_email)
  values (p_condo, auth.uid(), v_label, v_key, v_cat, v_status, v_flag, coalesce(p_notify, false));
  return case when v_status = 'review' then 'em_analise' else 'ok' end;
end $$;
grant execute on function public.request_indication(uuid, text, boolean) to authenticated;

drop function if exists public.open_requests(uuid);
create or replace function public.open_requests(p_condo uuid)
returns table (group_key text, label text, category_slug text, n bigint, i_asked boolean, i_notify boolean)
language plpgsql stable security definer set search_path = public as $$
declare g record;
begin
  if auth.uid() is null or not public.is_member(p_condo) then return; end if;
  for g in
    select coalesce('c' || r.category_id::text, r.label_key) as k,
           min(r.label) as lbl, max(r.category_id) as cat, count(distinct r.user_id) as cnt,
           bool_or(r.user_id = auth.uid()) as mine, bool_or(r.user_id = auth.uid() and r.notify_email) as mine_notify, max(r.created_at) as last_at
      from public.indication_requests r
     where r.status = 'open' and r.condo_id = any (public.condo_region_ids(p_condo)) and r.created_at > now() - interval '30 days'
     group by 1 order by count(distinct r.user_id) desc, max(r.created_at) desc limit 30
  loop
    if public.request_has_providers(p_condo, g.lbl, g.cat) then continue; end if;
    group_key := g.k;
    label := coalesce((select split_part(c.name, ' / ', 1) from public.categories c where c.id = g.cat), g.lbl);
    category_slug := (select c.slug from public.categories c where c.id = g.cat);
    n := g.cnt; i_asked := g.mine; i_notify := g.mine_notify;
    return next;
  end loop;
end $$;
grant execute on function public.open_requests(uuid) to authenticated;

-- Liga ou desliga o aviso por e-mail de um pedido da própria pessoa.
create or replace function public.set_request_notify(p_condo uuid, p_key text, p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.indication_requests set notify_email = coalesce(p_on, false)
   where user_id = auth.uid() and label_key = public.request_norm(p_key) and status in ('open','review') and public.is_member(p_condo);
$$;
grant execute on function public.set_request_notify(uuid, text, boolean) to authenticated;

-- Quem deve ser avisado por e-mail quando um prestador entra. SÓ o servidor do app (service_role) pode chamar.
create or replace function public.request_match_recipients(p_provider uuid)
returns table (request_id uuid, email text, label text, condo_slug text, category_slug text, provider_name text)
language sql stable security definer set search_path = public as $$
  select r.id, u.email::text, r.label, k.slug, c.slug, p.name
    from public.providers p
    join public.indication_requests r on r.status = 'open' and r.notify_email and r.emailed_at is null
         and r.condo_id = any (public.condo_region_ids(p.condo_id))
    join auth.users u on u.id = r.user_id
    join public.condominiums k on k.id = r.condo_id and k.is_active
    left join public.categories c on c.id = r.category_id
   where p.id = p_provider and p.status = 'active'
     and r.user_id is distinct from p.created_by and r.user_id is distinct from p.owner_id
     and ((r.category_id is not null and exists (select 1 from public.provider_categories pc where pc.provider_id = p.id and pc.category_id = r.category_id))
          or (r.category_id is null and exists (select 1 from public.search_provider_ids(r.condo_id, r.label) s where s.id = p.id)));
$$;
revoke all on function public.request_match_recipients(uuid) from public, anon, authenticated;
grant execute on function public.request_match_recipients(uuid) to service_role;

create or replace function public.mark_requests_emailed(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.indication_requests set emailed_at = now() where id = any (coalesce(p_ids, '{}'));
$$;
revoke all on function public.mark_requests_emailed(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_requests_emailed(uuid[]) to service_role;
