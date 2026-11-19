-- Indikaí — schema inicial (multi-condomínio, com RLS)
create extension if not exists pg_trgm;

-- ───────────── Tabelas ─────────────
create table public.condominiums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  icon text not null default '🔧',
  sort int not null default 100
);

create table public.members (
  user_id uuid not null references auth.users(id) on delete cascade,
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  block text not null check (char_length(block) between 1 and 20),
  unit text not null check (char_length(unit) between 1 and 20),
  role text not null default 'resident' check (role in ('resident','admin')),
  accepted_terms_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, condo_id)
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  category_id int not null references public.categories(id),
  created_by uuid not null references auth.users(id),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  whatsapp text not null check (whatsapp ~ '^55[0-9]{10,11}$'),
  photo_url text,
  kind text not null check (kind in ('resident','external')),
  block text,                       -- bloco do prestador, se for morador
  status text not null default 'active' check (status in ('active','hidden')),
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now()
);
-- Mesmo WhatsApp não pode se repetir no condomínio (duplicidade exata).
create unique index providers_condo_whatsapp_uq on public.providers (condo_id, whatsapp);
create index providers_condo_cat_idx on public.providers (condo_id, category_id);
create index providers_name_trgm_idx on public.providers using gin (lower(name) gin_trgm_ops);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  author_label text not null,       -- ex.: "Maria S. · Bloco B"
  rating int not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 600),
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now(),
  unique (provider_id, author_id)   -- 1 avaliação por morador por prestador
);
create index reviews_provider_idx on public.reviews (provider_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  condo_id uuid not null references public.condominiums(id) on delete cascade,
  reporter_id uuid not null references auth.users(id),
  provider_id uuid references public.providers(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(provider_id, review_id) = 1)
);

-- ───────────── Funções auxiliares ─────────────
create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and condo_id = c);
$$;

create or replace function public.is_admin(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members
                 where user_id = auth.uid() and condo_id = c and role = 'admin');
$$;

-- Condomínio existe e está ativo (security definer: quem ainda não é morador não enxerga a tabela).
create or replace function public.condo_is_active(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.condominiums where id = c and is_active);
$$;

-- Resolve o condomínio pelo link (aberto a anônimos; só expõe id e nome).
create or replace function public.condo_by_slug(s text)
returns table (id uuid, slug text, name text)
language sql stable security definer set search_path = public as $$
  select id, slug, name from public.condominiums where slug = s and is_active;
$$;
grant execute on function public.condo_by_slug(text) to anon, authenticated;

-- ───────────── Triggers ─────────────
-- Preenche o rótulo do autor da avaliação a partir do cadastro do morador.
create or replace function public.reviews_set_label() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.members; p public.providers; parts text[];
begin
  select * into p from public.providers where id = new.provider_id;
  if p.id is null or p.condo_id <> new.condo_id then
    raise exception 'prestador inválido';
  end if;
  select * into m from public.members where user_id = new.author_id and condo_id = new.condo_id;
  if m.user_id is null then raise exception 'não é morador deste condomínio'; end if;
  parts := regexp_split_to_array(trim(m.full_name), '\s+');
  new.author_label := parts[1]
    || case when array_length(parts,1) > 1 then ' ' || upper(left(parts[array_length(parts,1)],1)) || '.' else '' end
    || ' · Bloco ' || m.block;
  return new;
end $$;
create trigger reviews_before_insert before insert on public.reviews
  for each row execute function public.reviews_set_label();

-- Marca prestadores suspeitos (nome parecido na mesma categoria, ou muitos cadastros do mesmo autor).
create or replace function public.providers_check_flags() returns trigger
language plpgsql security definer set search_path = public as $$
declare similar_name text; recent int;
begin
  -- O cliente nunca define moderação: sempre recalculamos aqui.
  new.status := 'active';
  new.flagged := false;
  new.flag_reason := null;
  select p.name into similar_name from public.providers p
   where p.condo_id = new.condo_id and p.category_id = new.category_id
     and similarity(lower(p.name), lower(new.name)) > 0.55
   order by similarity(lower(p.name), lower(new.name)) desc limit 1;
  if similar_name is not null then
    new.flagged := true;
    new.flag_reason := 'Nome parecido com "' || similar_name || '" na mesma categoria';
  end if;
  select count(*) into recent from public.providers
   where created_by = new.created_by and created_at > now() - interval '24 hours';
  if recent >= 5 then
    new.flagged := true;
    new.flag_reason := coalesce(new.flag_reason || '; ', '') || 'Mesmo morador cadastrou muitos prestadores em 24h';
  end if;
  return new;
end $$;
create trigger providers_before_insert before insert on public.providers
  for each row execute function public.providers_check_flags();

-- ───────────── View com média e contagem ─────────────
create view public.provider_listing with (security_invoker = true) as
select p.*, c.slug as category_slug, c.name as category_name, c.icon as category_icon,
       coalesce(avg(r.rating) filter (where r.status = 'visible'), 0)::numeric(3,2) as avg_rating,
       count(r.id) filter (where r.status = 'visible')::int as review_count
from public.providers p
join public.categories c on c.id = p.category_id
left join public.reviews r on r.provider_id = p.id
group by p.id, c.id;

-- ───────────── RLS ─────────────
alter table public.condominiums enable row level security;
alter table public.categories   enable row level security;
alter table public.members      enable row level security;
alter table public.providers    enable row level security;
alter table public.reviews      enable row level security;
alter table public.reports      enable row level security;

create policy categories_read on public.categories for select to authenticated using (true);

create policy condos_read on public.condominiums for select to authenticated
  using (public.is_member(id));

create policy members_read on public.members for select to authenticated
  using (user_id = auth.uid() or public.is_admin(condo_id));
create policy members_insert on public.members for insert to authenticated
  with check (user_id = auth.uid() and role = 'resident'
              and public.condo_is_active(condo_id));

create policy providers_read on public.providers for select to authenticated
  using (public.is_member(condo_id) and (status = 'active' or public.is_admin(condo_id)));
create policy providers_insert on public.providers for insert to authenticated
  with check (public.is_member(condo_id) and created_by = auth.uid());
create policy providers_admin_update on public.providers for update to authenticated
  using (public.is_admin(condo_id)) with check (public.is_admin(condo_id));

create policy reviews_read on public.reviews for select to authenticated
  using (public.is_member(condo_id) and (status = 'visible' or public.is_admin(condo_id)));
create policy reviews_insert on public.reviews for insert to authenticated
  with check (public.is_member(condo_id) and author_id = auth.uid() and status = 'visible');
create policy reviews_admin_update on public.reviews for update to authenticated
  using (public.is_admin(condo_id)) with check (public.is_admin(condo_id));

create policy reports_insert on public.reports for insert to authenticated
  with check (public.is_member(condo_id) and reporter_id = auth.uid() and status = 'open');
create policy reports_admin_read on public.reports for select to authenticated
  using (public.is_admin(condo_id));
create policy reports_admin_update on public.reports for update to authenticated
  using (public.is_admin(condo_id)) with check (public.is_admin(condo_id));

-- ───────────── Storage (fotos de prestadores) ─────────────
insert into storage.buckets (id, name, public)
values ('provider-photos', 'provider-photos', true)
on conflict (id) do nothing;

create policy photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'provider-photos' and (storage.foldername(name))[1] = auth.uid()::text);
