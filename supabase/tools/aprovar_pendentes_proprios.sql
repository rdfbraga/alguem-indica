-- Aprova DE UMA VEZ os pedidos pendentes de quem cadastrou o PRÓPRIO perfil (sem alerta de duplicidade ou conteúdo suspeito).
-- Útil depois de ligar a aprovação automática (migration 0026), para limpar a fila que já existia.
-- Pedidos para assumir o perfil de OUTRA pessoa e perfis com alerta continuam pendentes para você decidir.
with ok as (
  select c.id as claim_id, c.provider_id, c.user_id
    from public.profile_claims c
    join public.providers p on p.id = c.provider_id
   where c.status = 'pending' and p.created_by = c.user_id and p.owner_id is null and not p.flagged
), up as (
  update public.providers p set owner_id = ok.user_id, owner_since = now() from ok where p.id = ok.provider_id returning p.id
)
update public.profile_claims c set status = 'approved', decided_at = now(), auto_approved = true
  from ok where c.id = ok.claim_id;

-- Conferência: quantos continuam pendentes
select count(*) as ainda_pendentes from public.profile_claims where status = 'pending';
