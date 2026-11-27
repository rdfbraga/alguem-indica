import Link from "next/link";
import { adminCancelPlan, adminGrantPlan, startTrial } from "@/app/c/[slug]/actions";
import { planState, type PlanRow } from "@/lib/features";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Cartão do plano Destaque no perfil: o dono vê o convite/teste; o admin vê o estado e os controles. */
export function PlanCard({
  slug,
  provider,
  plan,
  isOwner,
  isAdmin,
  canManage = false,
}: {
  slug: string;
  provider: { id: string; name: string };
  plan: PlanRow | null;
  isOwner: boolean;
  isAdmin: boolean;
  /** Administrador da plataforma: só ele concede ou cancela plano. */
  canManage?: boolean;
}) {
  const state = planState(plan);
  const askAdmin = `/c/${slug}/ajuda?tipo=suporte&msg=${encodeURIComponent(`Quero continuar com o plano Destaque no perfil "${provider.name}".`)}`;
  return (
    <div className="space-y-3 rounded-2xl border-2 border-brand-100 bg-brand-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold">⭐ Plano Destaque</span>
        {state.kind === "active" ? (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
            {state.trial ? "Teste grátis" : "Ativo"} · até {fmt(state.endsAt)}
          </span>
        ) : (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-navy/60">{state.kind === "expired" ? "Encerrado" : "Não ativo"}</span>
        )}
      </div>

      {isOwner && (
        <div className="space-y-2 text-sm">
          {state.kind === "active" ? (
            <>
              <p>Seu plano está ativo: restam <b>{state.daysLeft} {state.daysLeft === 1 ? "dia" : "dias"}</b>. Use a vitrine, a galeria de fotos e as respostas às avaliações.</p>
              <Link className="font-bold text-sky-brand underline" href={`/c/${slug}/assinar/${provider.id}`}>{state.trial ? "Assinar para continuar depois do teste" : "Renovar o plano"}</Link>
            </>
          ) : (
            <>
              <p>Com o plano Destaque você ganha:</p>
              <ul className="list-disc pl-5 text-navy/80">
                <li>Vitrine com seus serviços e preços</li>
                <li>Galeria de até 6 fotos</li>
                <li>Horários de atendimento</li>
                <li>Respostas públicas às avaliações</li>
              </ul>
              {state.trialAvailable ? (
                <form action={startTrial.bind(null, slug, provider.id)}>
                  <button className="btn !px-4 !py-2 !text-sm">Testar 30 dias grátis</button>
                </form>
              ) : (
                <div className="space-y-2">
                  {state.kind === "expired" ? <p>Seu plano terminou em {fmt(state.endedAt)}.</p> : null}
                  <Link className="btn !px-4 !py-2 !text-sm" href={`/c/${slug}/assinar/${provider.id}`}>⭐ Assinar o plano Destaque</Link>
                  <p className="text-xs text-navy/60">Dúvidas? <Link className="font-bold underline" href={askAdmin}>Fale com a administração</Link>.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isAdmin && canManage && (
        <div className="space-y-2 border-t border-brand-100 pt-3 text-sm">
          <div className="font-bold text-navy/70">Administração</div>
          {plan?.note ? <p className="text-xs text-navy/60">Obs.: {plan.note}</p> : null}
          <form action={adminGrantPlan.bind(null, slug, provider.id)} className="flex flex-wrap items-center gap-2">
            <select name="days" defaultValue="30" className="input !w-auto !py-2 !text-sm" aria-label="Dias de plano">
              <option value="30">+30 dias</option>
              <option value="90">+90 dias</option>
              <option value="365">+365 dias</option>
            </select>
            <input name="note" maxLength={200} placeholder="Observação (opcional)" className="input !w-auto min-w-40 flex-1 !py-2 !text-sm" />
            <button className="btn !px-3 !py-2 !text-sm">Conceder</button>
          </form>
          {state.kind === "active" && (
            <form action={adminCancelPlan.bind(null, slug, provider.id)}>
              <button className="text-xs font-semibold text-red-700 underline">Cancelar plano agora</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
