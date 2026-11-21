-- Buscas sem resultado entram sozinhas em "Os vizinhos estão procurando" (sem o morador precisar clicar em nada).
-- Regras para não virar ruído: só buscas de 3 a 60 letras, sem telefone/link/e-mail, sem texto suspeito; uma por pessoa e termo;
-- uma busca isolada NÃO aparece (precisa de 2 pessoas diferentes) e pedidos explícitos aparecem sempre. Nenhum e-mail é enviado por busca:
-- o aviso por e-mail continua só para quem pede. Depende da 0027/0028. Idempotente.

create table if not exists public.search_misses (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 3 and 60),
  label_key text not null,
  category_id int references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, label_key)
);
create index if not exists search_misses_condo_idx on public.search_misses (condo_id, created_at desc);
alter table public.search_misses enable row level security;   -- sem policies: só as funções abaixo
revoke all on public.search_misses from anon, authenticated;

-- A categoria que o texto representa (nome igual ou palavra-chave), se houver.
create or replace function public.request_category(p_key text) returns int
language sql stable security definer set search_path = public as $$
  select c.id from public.categories c
   where c.slug <> 'outros'
     and (public.request_norm(c.name) = p_key or public.request_norm(split_part(c.name, ' / ', 1)) = p_key
          or (char_length(p_key) >= 5 and public.request_norm(c.name || ' ' || coalesce(c.keywords, '')) like '%' || p_key || '%'))
   order by (public.request_norm(c.name) = p_key) desc, c.sort limit 1;
$$;

-- Registra uma busca que não achou ninguém. Silenciosa: nunca dá erro para a tela.
create or replace function public.log_search_miss(p_condo uuid, p_q text) returns void
language plpgsql security definer set search_path = public as $$
declare v_label text := regexp_replace(trim(coalesce(p_q, '')), '\s+', ' ', 'g'); v_key text; v_cat int;
begin
  if auth.uid() is null or not public.is_member(p_condo) then return; end if;
  if char_length(v_label) not between 3 and 60 then return; end if;
  if v_label ~ '[0-9]{4,}' or v_label ~ '(@|https?:|www\.|\.com)' then return; end if;      -- telefone, e-mail, link
  if v_label !~ '[[:alpha:]]{3,}' or v_label ~ '(.)\1{4,}' then return; end if;               -- sem letras ou repetido
  if public.content_flags(null, v_label, null, null) is not null then return; end if;
  if (select count(*) from public.search_misses where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then return; end if;
  v_key := public.request_norm(v_label);
  v_cat := public.request_category(v_key);
  if public.request_has_providers(p_condo, v_label, v_cat) then return; end if;
  insert into public.search_misses (condo_id, user_id, label, label_key, category_id)
  values (p_condo, auth.uid(), v_label, v_key, v_cat)
  on conflict (user_id, label_key) do update set created_at = now();
end $$;
grant execute on function public.log_search_miss(uuid, text) to authenticated;

-- Pedidos explícitos + buscas sem resultado, agrupados, que ainda NÃO têm indicação (30 dias, região toda).
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
    having bool_or(s.explicit) or count(distinct s.user_id) >= 2
     order by count(distinct s.user_id) desc, max(s.created_at) desc limit 30
  loop
    if public.request_has_providers(p_condo, g.lbl, g.cat) then continue; end if;
    group_key := g.k;
    label := coalesce((select split_part(c.name, ' / ', 1) from public.categories c where c.id = g.cat), g.lbl);
    category_slug := (select c.slug from public.categories c where c.id = g.cat);
    n := g.cnt; i_asked := g.mine; i_notify := g.mine_notify; i_searched := g.mine_search;
    return next;
  end loop;
end $$;
grant execute on function public.open_requests(uuid) to authenticated;
