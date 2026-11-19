import type { AdRow } from "@/lib/types";
import { AdTracker } from "./AdTracker";

/** Anúncio de comerciante local na home. Sempre identificado como patrocinado. */
export function AdCard({ slug, ad }: { slug: string; ad: AdRow }) {
  return (
    <aside className="card space-y-2 !border-navy/10" aria-label="Anúncio de parceiro do condomínio">
      <AdTracker adId={ad.id} />
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-navy/50">
        <span>Patrocinado · Parceiro do condomínio</span>
        <span className="normal-case">{ad.advertiser}</span>
      </div>
      <div className="flex gap-3">
        {ad.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.image_url} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" loading="lazy" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-extrabold leading-tight">{ad.title}</div>
          {ad.body && <p className="mt-0.5 text-sm text-navy/75">{ad.body}</p>}
          <a
            href={`/c/${slug}/go/ad/${ad.id}`}
            target="_blank"
            rel="noopener noreferrer sponsored nofollow"
            className="btn mt-2 !px-4 !py-2 !text-sm"
          >
            {ad.cta_label}
          </a>
        </div>
      </div>
    </aside>
  );
}
