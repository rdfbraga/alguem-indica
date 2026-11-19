import Link from "next/link";
import type { ProviderRow } from "@/lib/types";
import { Stars } from "./Stars";

export function ProviderCard({ slug, p }: { slug: string; p: ProviderRow }) {
  return (
    <Link href={`/c/${slug}/p/${p.id}`} className="card flex items-center gap-3 transition hover:border-brand-500">
      {p.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xl">
          {p.category_icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{p.name}</div>
        <div className="truncate text-sm text-stone-500">
          {p.category_name}
          {p.kind === "resident" ? ` · Morador${p.block ? ` (Bloco ${p.block})` : ""}` : " · Externo indicado"}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-sm">
          {p.review_count > 0 ? (
            <>
              <Stars value={p.avg_rating} />
              <span className="text-stone-500">
                {Number(p.avg_rating).toFixed(1)} ({p.review_count})
              </span>
            </>
          ) : (
            <span className="text-stone-400">Sem avaliações ainda</span>
          )}
        </div>
      </div>
    </Link>
  );
}
