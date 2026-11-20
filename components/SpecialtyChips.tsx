import Link from "next/link";

/** Filtro por especialidade dentro de uma categoria (só as que têm prestadores). Tudo via URL, sem JavaScript. */
export function SpecialtyChips({
  base,
  options,
  current,
  total,
  keep,
}: {
  base: string;
  options: { slug: string; name: string; count: number }[];
  current?: string;
  total: number;
  keep: Record<string, string | undefined>;
}) {
  if (options.length === 0) return null;
  const href = (esp?: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, esp })) if (v) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border-2 px-3 py-1 text-sm font-bold transition ${active ? "border-navy bg-navy text-white" : "border-navy/15 bg-white text-navy hover:border-sky-brand/50"}`;
  return (
    <div className="space-y-1">
      <div className="text-xs font-bold text-navy/60">Especialidade</div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por especialidade">
        <Link href={href()} replace scroll={false} aria-current={!current ? "true" : undefined} className={chip(!current)}>Todas ({total})</Link>
        {options.map((o) => (
          <Link key={o.slug} href={href(o.slug)} replace scroll={false} aria-current={current === o.slug ? "true" : undefined} className={chip(current === o.slug)}>
            {o.name} ({o.count})
          </Link>
        ))}
      </div>
    </div>
  );
}
