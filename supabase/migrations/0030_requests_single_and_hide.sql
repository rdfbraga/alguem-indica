-- 1) Uma única pessoa já basta para um item aparecer em "Os vizinhos estão procurando" (antes eram 2 para buscas).
-- 2) O administrador pode ocultar um item do bloco (vale para a região toda) e reexibir depois. Depende da 0029. Idempotente.

create table if not exists public.request_hidden (
  condo_id uuid not null references public.condominiums(id) on delete cascade,   -- condomínio do admin que ocultou
  group_key text not null,
  label text not null,
  created_at timestamptz not null default now(),
  primary key (condo_id, group_key)
);
alter table public.request_hidden enable row level security;   -- sem policies: só as funções abaixo
revoke all on public.request_hidden from anon, authenticated;

drop function if exists public.open_requests(uuid);
create or replace function public.open_requests(p_condo uuid)
returns table (group_key text, label text, category_slug text, n bigint, i_asked boolean, i_notify boolean, i_searched boolean)
language plpgsql stable security definer set search_path = public as $$
declare g record;
begin
  if auth.uid() is null or not public.is_member(p_condo) then return; end if;
  for g in
    with src as (
      select r.user_id, r.label, r.label_key, r.category_id, true as explicit, r.notify_email as notify, r.created_at
        from public.indication_requests r
       where r.status = 'open' and r.condo_id = any (public.condo_region_ids(p_condo)) and r.created_at > now() - interval '30 days'
      union all
      select m.user_id, m.label, m.label_key, m.category_id, false, false, m.created_at
        from public.search_misses m
       where m.condo_id = any (public.condo_region_ids(p_condo)) and m.created_at > now() - interval '30 days'
    )
    select coalesce('c' || s.category_id::text, s.label_key) as k, min(s.label) as lbl, max(s.category_id) as cat,
           count(distinct s.user_id) as cnt,
           bool_or(s.explicit) as has_explicit,
           bool_or(s.user_id = auth.uid() and s.explicit) as mine,
           bool_or(s.user_id = auth.uid() and s.explicit and s.notify) as mine_notify,
           bool_or(s.user_id = auth.uid() and not s.explicit) as mine_search,
           max(s.created_at) as last_at
      from src s group by 1
     order by count(distinct s.user_id) desc, max(s.created_at) desc limit 30
  loop
    if exists (select 1 from public.request_hidden h where h.condo_id = any (public.condo_region_ids(p_condo)) and h.group_key = g.k) then continue; end if;
    if public.request_has_providers(p_condo, g.lbl, g.cat) then continue; end if;
    group_key := g.k;
    label := coalesce((select split_part(c.name, ' / ', 1) from public.categories c where c.id = g.cat), g.lbl);
    category_slug := (select c.slug from public.categories c where c.id = g.cat);
    n := g.cnt; i_asked := g.mine; i_notify := g.mine_notify; i_searched := g.mine_search;
    return next;
  end loop;
end $$;
grant execute on function public.open_requests(uuid) to authenticated;

create or replace function public.admin_hide_request(p_condo uuid, p_key text, p_label text, p_hide boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  if p_hide then
    insert into public.request_hidden (condo_id, group_key, label) values (p_condo, left(p_key, 80), left(coalesce(p_label, p_key), 60))
    on conflict (condo_id, group_key) do nothing;
  else
    delete from public.request_hidden where condo_id = any (public.condo_region_ids(p_condo)) and group_key = left(p_key, 80);
  end if;
end $$;
grant execute on function public.admin_hide_request(uuid, text, text, boolean) to authenticated;

create or replace function public.admin_hidden_requests(p_condo uuid)
returns table (group_key text, label text)
language sql stable security definer set search_path = public as $$
  select h.group_key, h.label from public.request_hidden h
   where public.is_admin(p_condo) and h.condo_id = any (public.condo_region_ids(p_condo)) order by h.created_at desc;
$$;
grant execute on function public.admin_hidden_requests(uuid) to authenticated;
