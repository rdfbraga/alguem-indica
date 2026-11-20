-- Varre os perfis JÁ existentes com a triagem de conteúdo (migration 0017) e marca os suspeitos
-- em Admin → Moderar. Opcional e seguro: não oculta nada. Rodar de novo remarca o que o admin já liberou.
update public.providers p
   set flagged = true,
       flag_reason = coalesce(p.flag_reason || '; ', '') || public.content_flags(
         p.name, p.description, coalesce(p.custom_category, '') || ' ' || coalesce(p.custom_specialty, ''), p.website)
 where p.flagged = false
   and public.content_flags(p.name, p.description, coalesce(p.custom_category, '') || ' ' || coalesce(p.custom_specialty, ''), p.website) is not null;
