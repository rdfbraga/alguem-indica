import Link from "next/link";
import type { ProviderRow } from "@/lib/types";
import { Stars } from "./Stars";
import { providerCategoryLabels } from "@/lib/categories";
import { providerSpecialtyLabels } from "@/lib/specialties";
import { blockText, type CondoKind } from "@/lib/condo-kind";

export function ProviderCard({ slug, p, planBadge = false, viewerCondoId, kind = "building" }: { slug: string; p: ProviderRow; planBadge?: boolean; viewerCondoId?: string; kind?: CondoKind }) {
  const foreign = Boolean(viewerCondoId && p.condo_id !== viewerCondoId);   // indicado em outro condomínio da região
  return (
    <Link href={`/c/${slug}/p/${p.id}`} className="card flex items-center gap-3 transition hover:-translate-y-0.5 hover:border-brand-500">
      {p.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-brand-100" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xl ring-2 ring-brand-100">
          {p.category_icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-extrabold">{p.name}{planBadge && p.plan_active ? <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 align-middle text-[10px] font-bold text-brand-700">⭐ Destaque</span> : null}</div>
        <div className="truncate text-sm text-navy/60">
          {providerCategoryLabels(p).join(" · ")}
          {p.kind === "resident" ? ` · Morador${p.block && !foreign ? ` (${blockText(kind, p.block)})` : ""}` : " · Externo indicado"}
          {p.self_pending ? " · Cadastro próprio" : ""}
        </div>
        {foreign && <div className="truncate text-xs font-semibold text-sky-brand">📍 {p.condo_name ?? "Condomínio vizinho"}</div>}
        {providerSpecialtyLabels(p).length > 0 && (
          <div className="truncate text-xs font-semibold text-brand-700">{providerSpecialtyLabels(p).join(" · ")}</div>
        )}
        <div className="mt-0.5 flex items-center gap-1 text-sm">
          {p.review_count > 0 ? (
            <>
              <Stars value={p.avg_rating} />
              <span className="text-navy/60">
                {Number(p.avg_rating).toFixed(1)} ({p.review_count})
              </span>
            </>
          ) : (
            <span className="text-navy/45">Sem avaliações ainda</span>
          )}
        </div>
      </div>
    </Link>
  );
}
