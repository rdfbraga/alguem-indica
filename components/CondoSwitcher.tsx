import Link from "next/link";

export type MyCondo = { slug: string; name: string };

/**
 * Nome do condomínio no cabeçalho. Se a pessoa tem mais de um (ou há outros condomínios na região), vira um menu
 * para trocar de condomínio sem digitar link. Usa <details>, então não depende de JavaScript.
 */
export function CondoSwitcher({ current, condos, regionSlug }: { current: MyCondo; condos: MyCondo[]; regionSlug: string | null }) {
  const others = condos.filter((c) => c.slug !== current.slug);
  if (others.length === 0 && !regionSlug) {
    return <div className="mt-0.5 truncate pl-[3.1rem] text-xs font-semibold text-sky-brand">{current.name}</div>;
  }
  return (
    <details className="relative mt-0.5 pl-[3.1rem]">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-sky-brand [&::-webkit-details-marker]:hidden" aria-label="Trocar de condomínio">
        <span className="truncate">{current.name}</span>
        <span aria-hidden className="shrink-0 rounded bg-sky-soft px-1 text-[10px]">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[85vw] rounded-2xl border border-navy/10 bg-white p-1.5 shadow-lg">
        <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-navy/45">Seus condomínios</div>
        <ul>
          {condos.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/c/${c.slug}`}
                aria-current={c.slug === current.slug ? "true" : undefined}
                className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold ${c.slug === current.slug ? "bg-brand-50 text-brand-700" : "text-navy hover:bg-sky-soft"}`}
              >
                <span className="truncate">🏠 {c.name}</span>
                {c.slug === current.slug && <span className="shrink-0 text-xs">aqui</span>}
              </Link>
            </li>
          ))}
        </ul>
        <p className="border-t border-navy/10 px-2.5 pb-1 pt-2 text-[11px] leading-snug text-navy/55">
          Mora em um condomínio de outra região? Abra o link dele (peça no grupo do condomínio) e faça o cadastro lá. Depois ele aparece aqui.
        </p>
        {regionSlug && (
          <Link href={`/r/${regionSlug}?trocar=1`} className="mt-1 block rounded-xl border-t border-navy/10 px-2.5 py-2 text-sm font-semibold text-sky-brand hover:bg-sky-soft">
            ＋ Entrar em outro condomínio da região
          </Link>
        )}
      </div>
    </details>
  );
}
