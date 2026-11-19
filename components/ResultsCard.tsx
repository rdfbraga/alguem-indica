import Link from "next/link";
import { BarChart } from "./BarChart";
import { StatTile } from "./StatTile";
import { delta, longDate, type ProviderStats } from "@/lib/stats";

export function ResultsCard({
  slug,
  profile,
  stats,
}: {
  slug: string;
  profile: { id: string; name: string; instagram?: string | null; website?: string | null };
  stats: ProviderStats;
}) {
  const { totals: t, prev: p, series, days } = stats;
  const views = series.map((s) => ({ d: s.d, value: s.viewers }));
  const wa = series.map((s) => ({ d: s.d, value: s.whatsapp }));
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold">
        <Link href={`/c/${slug}/p/${profile.id}`} className="underline decoration-navy/20 underline-offset-4">{profile.name}</Link>
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Pessoas que viram o perfil" value={t.viewers} delta={delta(t.viewers, p.viewers)} days={days} />
        <StatTile label="Cliques em “Chamar no WhatsApp”" value={t.whatsapp} delta={delta(t.whatsapp, p.whatsapp)} days={days} />
        {profile.instagram ? <StatTile label="Cliques no Instagram" value={t.instagram} delta={delta(t.instagram, p.instagram)} days={days} /> : null}
        {profile.website ? <StatTile label="Cliques no site" value={t.website} delta={delta(t.website, p.website)} days={days} /> : null}
        <StatTile
          label="Avaliações novas"
          value={stats.reviews_new}
          hint={stats.reviews_total > 0 ? `Nota média ${Number(stats.reviews_avg).toFixed(1)} (${stats.reviews_total} no total)` : "Ainda sem avaliações"}
        />
      </div>

      <BarChart title="Pessoas que viram o perfil, por dia" points={views} one="pessoa" many="pessoas" summary={`${t.viewers} ${t.viewers === 1 ? "pessoa" : "pessoas"} no período`} />
      <BarChart title="Cliques no WhatsApp, por dia" points={wa} one="clique" many="cliques" />

      <details className="card !p-3 text-sm">
        <summary className="cursor-pointer font-bold text-sky-brand">Ver os números em tabela</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white text-xs text-navy/60">
              <tr><th className="py-1 pr-2">Dia</th><th className="py-1 pr-2">Pessoas</th><th className="py-1">Cliques no WhatsApp</th></tr>
            </thead>
            <tbody>
              {[...series].reverse().map((s) => (
                <tr key={s.d} className="border-t border-navy/10">
                  <td className="py-1 pr-2">{longDate(s.d)}</td>
                  <td className="py-1 pr-2 tabular-nums">{s.viewers}</td>
                  <td className="py-1 tabular-nums">{s.whatsapp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
