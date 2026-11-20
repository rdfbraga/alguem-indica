-- Varre os perfis JÁ existentes com a triagem de conteúdo (migration 0017) e marca os suspeitos
-- em Admin → Moderar. Opcional e seguro: não oculta nada. Rodar de novo remarca o que o admin já liberou.
update public.providers p
   set flagged = true,
       flag_reason = coalesce(p.flag_reason || '; ', '') || public.content_flags(
         p.name, p.description, coalesce(p.custom_category, '') || ' ' || coalesce(p.custom_specialty, ''), p.website)
 where p.flagged = false
   and public.content_flags(p.name, p.description, coalesce(p.custom_category, '') || ' ' || coalesce(p.custom_specialty, ''), p.website) is not null;

-- Comentários de avaliação já existentes (migration 0018): abre denúncia automática para os suspeitos.
insert into public.reports (condo_id, reporter_id, review_id, reason)
select r.condo_id, r.author_id, r.id, left('[Triagem automática] ' || public.content_flags(null, r.comment, null, null), 300)
  from public.reviews r
 where r.status = 'visible'
   and public.content_flags(null, r.comment, null, null) is not null
   and not exists (select 1 from public.reports x where x.review_id = r.id and x.status = 'open');
