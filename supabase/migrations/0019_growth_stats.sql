-- Indicadores de crescimento do condomínio (só admin): moradores, prestadores, avaliações, uso e oferta x procura.
-- Compara o período com o anterior de mesmo tamanho. Idempotente.
create or replace function public.growth_stats(p_condo uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 90);
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_from date; v_from_ts timestamptz; v_prev_ts timestamptz; v_7_ts timestamptz;
  series jsonb; tot jsonb; prev jsonb; snap jsonb; eng jsonb; cats jsonb; gaps jsonb; blocks jsonb;
begin
  if not public.is_admin(p_condo) then raise exception 'apenas administradores'; end if;
  v_from := v_today - (v_days - 1);
  v_from_ts := (v_from::timestamp at time zone 'America/Sao_Paulo');
  v_prev_ts := ((v_from - v_days)::timestamp at time zone 'America/Sao_Paulo');
  v_7_ts := ((v_today - 6)::timestamp at time zone 'America/Sao_Paulo');

  select coalesce(jsonb_agg(jsonb_build_object(
           'd', to_char(g.d, 'YYYY-MM-DD'),
           'members', coalesce(m.n, 0), 'providers', coalesce(p.n, 0), 'reviews', coalesce(r.n, 0),
           'viewers', coalesce(e.viewers, 0), 'whatsapp', coalesce(e.whatsapp, 0)) order by g.d), '[]'::jsonb)
    into series
    from (select generate_series(v_from, v_today, interval '1 day')::date as d) g
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from public.members
                where condo_id = p_condo and created_at >= v_from_ts group by 1) m on m.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from public.providers
                where condo_id = p_condo and created_at >= v_from_ts group by 1) p on p.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n from public.reviews
                where condo_id = p_condo and status = 'visible' and created_at >= v_from_ts group by 1) r on r.d = g.d
    left join (select (created_at at time zone 'America/Sao_Paulo')::date d,
                      count(distinct user_id) filter (where kind = 'view') viewers,
                      count(*) filter (where kind = 'whatsapp') whatsapp
                 from public.provider_events where condo_id = p_condo and created_at >= v_from_ts group by 1) e on e.d = g.d;

  select jsonb_build_object(
    'members', (select count(*) from public.members where condo_id = p_condo and created_at >= v_from_ts),
    'providers', (select count(*) from public.providers where condo_id = p_condo and created_at >= v_from_ts),
    'reviews', (select count(*) from public.reviews where condo_id = p_condo and status = 'visible' and created_at >= v_from_ts),
    'viewers', (select count(distinct user_id) from public.provider_events where condo_id = p_condo and kind = 'view' and created_at >= v_from_ts),
    'views', (select count(*) from public.provider_events where condo_id = p_condo and kind = 'view' and created_at >= v_from_ts),
    'whatsapp', (select count(*) from public.provider_events where condo_id = p_condo and kind = 'whatsapp' and created_at >= v_from_ts))
    into tot;
  select jsonb_build_object(
    'members', (select count(*) from public.members where condo_id = p_condo and created_at >= v_prev_ts and created_at < v_from_ts),
    'providers', (select count(*) from public.providers where condo_id = p_condo and created_at >= v_prev_ts and created_at < v_from_ts),
    'reviews', (select count(*) from public.reviews where condo_id = p_condo and status = 'visible' and created_at >= v_prev_ts and created_at < v_from_ts),
    'viewers', (select count(distinct user_id) from public.provider_events where condo_id = p_condo and kind = 'view' and created_at >= v_prev_ts and created_at < v_from_ts),
    'views', (select count(*) from public.provider_events where condo_id = p_condo and kind = 'view' and created_at >= v_prev_ts and created_at < v_from_ts),
    'whatsapp', (select count(*) from public.provider_events where condo_id = p_condo and kind = 'whatsapp' and created_at >= v_prev_ts and created_at < v_from_ts))
    into prev;

  select jsonb_build_object(
    'members', (select count(*) from public.members where condo_id = p_condo),
    'providers', (select count(*) from public.providers where condo_id = p_condo and status = 'active'),
    'residents', (select count(*) from public.providers where condo_id = p_condo and status = 'active' and kind = 'resident'),
    'owners', (select count(*) from public.providers where condo_id = p_condo and status = 'active' and owner_id is not null),
    'reviewed', (select count(distinct r.provider_id) from public.reviews r join public.providers p on p.id = r.provider_id
                  where r.condo_id = p_condo and r.status = 'visible' and p.status = 'active'),
    'reviews', (select count(*) from public.reviews where condo_id = p_condo and status = 'visible'))
    into snap;

  -- engajamento: quantos moradores usam de verdade
  select jsonb_build_object(
    'active7', (select count(distinct user_id) from public.provider_events where condo_id = p_condo and created_at >= v_7_ts),
    'active_period', (select count(distinct user_id) from public.provider_events where condo_id = p_condo and created_at >= v_from_ts),
    'returning', (select count(*) from (select user_id from public.provider_events
                   where condo_id = p_condo and created_at >= v_from_ts and user_id is not null
                   group by user_id having count(distinct (created_at at time zone 'America/Sao_Paulo')::date) >= 2) x),
    'contacted', (select count(distinct user_id) from public.provider_events where condo_id = p_condo and kind = 'whatsapp' and created_at >= v_from_ts))
    into eng;

  -- categorias mais procuradas (cliques/visitas no período) e quantos perfis ativos cada uma tem
  select coalesce(jsonb_agg(t order by (t->>'whatsapp')::int desc, (t->>'views')::int desc), '[]'::jsonb) into cats
    from (select jsonb_build_object('name', c.name, 'icon', c.icon,
                   'whatsapp', count(*) filter (where e.kind = 'whatsapp'),
                   'views', count(*) filter (where e.kind = 'view'),
                   'providers', (select count(*) from public.providers q where q.condo_id = p_condo and q.status = 'active' and q.category_id = c.id)) t
            from public.provider_events e join public.providers p on p.id = e.provider_id join public.categories c on c.id = p.category_id
           where e.condo_id = p_condo and e.created_at >= v_from_ts and e.kind in ('view','whatsapp')
           group by c.id, c.name, c.icon
           order by count(*) filter (where e.kind = 'whatsapp') desc, count(*) filter (where e.kind = 'view') desc limit 6) x;

  -- procura sem oferta: categorias com visitas no período e até 2 perfis
  select coalesce(jsonb_agg(t order by (t->>'views')::int desc), '[]'::jsonb) into gaps
    from (select jsonb_build_object('name', c.name, 'icon', c.icon, 'views', count(*), 'providers',
                   (select count(*) from public.providers q where q.condo_id = p_condo and q.status = 'active' and q.category_id = c.id)) t
            from public.provider_events e join public.providers p on p.id = e.provider_id join public.categories c on c.id = p.category_id
           where e.condo_id = p_condo and e.created_at >= v_from_ts and e.kind = 'view'
           group by c.id, c.name, c.icon
          having (select count(*) from public.providers q where q.condo_id = p_condo and q.status = 'active' and q.category_id = c.id) <= 2
           order by count(*) desc limit 5) x;

  -- adesão por bloco (moradores cadastrados)
  select coalesce(jsonb_agg(jsonb_build_object('block', block, 'n', n) order by n desc, block), '[]'::jsonb) into blocks
    from (select block, count(*) n from public.members where condo_id = p_condo group by block order by count(*) desc, block limit 10) b;

  return jsonb_build_object('days', v_days, 'series', series, 'totals', tot, 'prev', prev, 'snapshot', snap,
                            'engagement', eng, 'categories', cats, 'gaps', gaps, 'blocks', blocks);
end $$;
grant execute on function public.growth_stats(uuid, int) to authenticated;
