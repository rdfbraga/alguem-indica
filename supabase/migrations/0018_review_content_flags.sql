-- Triagem automática também nos comentários das avaliações: se o texto parece impróprio, spam ou golpe,
-- abre uma denúncia automática (Admin → Moderar → Denúncias) com o motivo. A avaliação continua visível
-- até o admin decidir. Depende da 0017. Idempotente.

create or replace function public.reviews_check_content() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_reason text;
begin
  if tg_op = 'UPDATE' and new.comment is not distinct from old.comment then return new; end if;
  v_reason := public.content_flags(null, new.comment, null, null);
  if v_reason is null then return new; end if;
  if exists (select 1 from public.reports where review_id = new.id and status = 'open') then return new; end if;
  insert into public.reports (condo_id, reporter_id, review_id, reason)
  values (new.condo_id, new.author_id, new.id, left('[Triagem automática] ' || v_reason, 300));
  return new;
end $$;

drop trigger if exists reviews_after_content on public.reviews;
create trigger reviews_after_content after insert or update of comment on public.reviews
  for each row execute function public.reviews_check_content();
