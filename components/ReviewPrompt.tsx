import Link from "next/link";
import { dismissReviewPrompt } from "@/app/c/[slug]/actions";

export type ReviewPromptItem = { provider_id: string; name: string; category_name: string; category_icon: string; contacted_at: string };

function ago(iso: string) {
  const days = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return days === 1 ? "ontem" : `há ${days} dias`;
}

/** Convite na tela inicial: "Você chamou X. Como foi?". Some ao avaliar ou ao tocar em "Não contratei". */
export function ReviewPrompt({ slug, items }: { slug: string; items: ReviewPromptItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Avalie quem você chamou">
      {items.map((it) => (
        <div key={it.provider_id} className="card space-y-3 !border-brand-500/40 !bg-brand-50/60">
          <div>
            <div className="text-sm font-semibold text-navy/65">Você chamou {ago(it.contacted_at)}</div>
            <div className="text-lg font-extrabold">{it.category_icon} {it.name}</div>
            <p className="text-sm text-navy/75">Deu certo? Sua avaliação ajuda os vizinhos a escolher bem.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/c/${slug}/p/${it.provider_id}#avaliar`} className="btn !px-4 !py-2 !text-sm">⭐ Avaliar</Link>
            <form action={dismissReviewPrompt.bind(null, slug, it.provider_id)}>
              <button className="text-sm font-semibold text-navy/60 underline">Não contratei</button>
            </form>
          </div>
        </div>
      ))}
    </section>
  );
}
