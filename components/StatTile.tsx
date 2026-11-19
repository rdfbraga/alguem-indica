import { deltaText, type Delta } from "@/lib/stats";

/** Indicador: rótulo, valor grande e variação (com seta e texto, nunca só cor). */
export function StatTile({ label, value, delta, days, hint }: { label: string; value: string | number; delta?: Delta; days?: number; hint?: string }) {
  const tone =
    delta?.kind === "up" || delta?.kind === "new" ? "text-green-700" : delta?.kind === "down" ? "text-red-700" : "text-navy/55";
  return (
    <div className="card !p-3">
      <div className="text-xs font-semibold text-navy/65">{label}</div>
      <div className="mt-1 text-3xl font-extrabold leading-none">{value}</div>
      {delta && days ? <div className={`mt-2 text-xs font-semibold ${tone}`}>{deltaText(delta, days)}</div> : null}
      {hint ? <div className="mt-1 text-xs text-navy/55">{hint}</div> : null}
    </div>
  );
}
