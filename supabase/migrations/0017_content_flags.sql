-- Triagem automática de conteúdo: o sistema marca como "inconsistência" (aparece em Admin → Moderar)
-- perfis com texto possivelmente impróprio, spam ou golpe. Nada é ocultado sozinho: a decisão é do admin.
-- Roda ao cadastrar e sempre que nome, descrição, categoria/especialidade em texto ou site forem alterados. Idempotente.

create or replace function public.content_flags(p_name text, p_description text, p_extra text, p_website text)
returns text
language plpgsql immutable set search_path = public as $$
declare
  v_all text := lower(unaccent(coalesce(p_name, '') || ' ' || coalesce(p_description, '') || ' ' || coalesce(p_extra, '')));
  v_hit text;
  v_reasons text[] := '{}';
  v_letters int; v_upper int; v_raw text := coalesce(p_name, '') || ' ' || coalesce(p_description, '');
begin
  -- palavrões, ofensas e conteúdo adulto
  select m[1] into v_hit from regexp_matches(v_all,
    '\m(puta|putaria|caralho|buceta|viado|fdp|arrombad[oa]|cuzao|babaca|otari[oa]|vagabund[oa]|nazista|estupr\w+|acompanhante|garota de programa|nudes?|sexo|sexshop|erotic[oa]|swing)\M') m limit 1;
  if v_hit is not null then v_reasons := array_append(v_reasons, 'Possível texto impróprio ("' || v_hit || '")'::text); end if;

  -- spam e golpes comuns
  select m[1] into v_hit from regexp_matches(v_all,
    '\m(ganhe dinheiro|renda extra|investimento|cripto\w*|bitcoin|forex|cassino|apostas?|bet|tigrinho|emprestimo|credito facil|seguidores|sorteio|trabalhe em casa|piramide)\M') m limit 1;
  if v_hit is not null then v_reasons := array_append(v_reasons, 'Possível spam ou golpe ("' || v_hit || '")'::text); end if;

  -- link ou contato dentro do texto (o certo é usar os campos próprios)
  if coalesce(p_description, '') ~* '(https?://|www\.|\.com\M|\.com\.br|@[a-z0-9_.]{3,}|t\.me/|wa\.me/)' then
    v_reasons := array_append(v_reasons, 'Link ou contato escrito na descrição'::text);
  end if;

  -- LETRAS MAIÚSCULAS demais ou caracteres repetidos
  v_letters := char_length(regexp_replace(v_raw, '[^A-Za-zÀ-ÿ]', '', 'g'));
  v_upper := char_length(regexp_replace(v_raw, '[^A-ZÀ-Þ]', '', 'g'));
  if v_letters >= 15 and v_upper::numeric / v_letters > 0.7 then v_reasons := array_append(v_reasons, 'Texto todo em maiúsculas'::text); end if;
  if v_raw ~ '(.)\1{5,}' then v_reasons := array_append(v_reasons, 'Caracteres repetidos'::text); end if;

  -- sites que não são do prestador (encurtadores)
  if coalesce(p_website, '') ~* '^https?://(bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|t\.co)/' then
    v_reasons := array_append(v_reasons, 'Site é um link encurtado'::text);
  end if;

  if array_length(v_reasons, 1) is null then return null; end if;
  return array_to_string(v_reasons, '; ');
end $$;

-- Cadastro novo: mantém as regras de duplicidade e soma a triagem de conteúdo.
create or replace function public.providers_check_flags() returns trigger
language plpgsql security definer set search_path = public as $$
declare similar_name text; recent int; cat_slug text; v_content text;
begin
  -- O cliente nunca define moderação: sempre recalculamos aqui.
  new.status := 'active';
  new.flagged := false;
  new.flag_reason := null;
  new.custom_category_reviewed := false;
  select slug into cat_slug from public.categories where id = new.category_id;
  if cat_slug is distinct from 'outros' then new.custom_category := null; end if;
  new.custom_category := nullif(trim(new.custom_category), '');

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
  v_content := public.content_flags(new.name, new.description, coalesce(new.custom_category, '') || ' ' || coalesce(new.custom_specialty, ''), new.website);
  if v_content is not null then
    new.flagged := true;
    new.flag_reason := coalesce(new.flag_reason || '; ', '') || v_content;
  end if;
  return new;
end $$;

-- Edição: se o texto mudou e a triagem encontra algo, o perfil volta para a fila de inconsistências.
create or replace function public.providers_recheck_content() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_content text;
begin
  if new.name is not distinct from old.name and new.description is not distinct from old.description
     and new.custom_category is not distinct from old.custom_category
     and new.custom_specialty is not distinct from old.custom_specialty
     and new.website is not distinct from old.website then
    return new;
  end if;
  v_content := public.content_flags(new.name, new.description, coalesce(new.custom_category, '') || ' ' || coalesce(new.custom_specialty, ''), new.website);
  if v_content is not null then
    new.flagged := true;
    new.flag_reason := case when old.flagged and old.flag_reason is not null and position(v_content in old.flag_reason) = 0
                            then old.flag_reason || '; ' || v_content else v_content end;
  end if;
  return new;
end $$;
drop trigger if exists providers_before_update_content on public.providers;
create trigger providers_before_update_content before update on public.providers
  for each row execute function public.providers_recheck_content();
