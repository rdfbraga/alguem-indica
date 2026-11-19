import type { PhotoRow, ServiceRow } from "@/lib/types";

/** Vitrine pública do perfil: serviços e preços, horários e fotos. Não renderiza nada se estiver vazia. */
export function ShowcaseView({ hours, services, photos }: { hours: string | null; services: ServiceRow[]; photos: PhotoRow[] }) {
  if (!hours && services.length === 0 && photos.length === 0) return null;
  return (
    <section className="card space-y-4">
      {services.length > 0 && (
        <div>
          <h2 className="mb-2 font-extrabold">🛍️ Serviços e preços</h2>
          <ul className="divide-y divide-navy/10">
            {services.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-bold">{s.title}</div>
                  {s.description && <div className="text-sm text-navy/65">{s.description}</div>}
                </div>
                {s.price_text && <div className="shrink-0 text-right font-extrabold text-brand-700">{s.price_text}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {hours && (
        <div>
          <h2 className="mb-1 font-extrabold">🕘 Horários de atendimento</h2>
          <p className="whitespace-pre-line text-navy/80">{hours}</p>
        </div>
      )}
      {photos.length > 0 && (
        <div>
          <h2 className="mb-2 font-extrabold">📸 Fotos</h2>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((ph) => (
              <a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-navy/10" title={ph.caption ?? "Ver foto"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.caption ?? "Foto do profissional"} className="aspect-square w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
