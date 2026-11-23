export type StatsDay = { d: string; views: number; viewers: number; whatsapp: number; instagram: number; website: number };
export type StatsTotals = { views: number; viewers: number; whatsapp: number; instagram: number; website: number };
export type ProviderStats = {
  days: number;
  series: StatsDay[];
  totals: StatsTotals;
  prev: StatsTotals;
  reviews_new: number;
  reviews_total: number;
  reviews_avg: number | null;
};

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export function parsePeriod(v: string | undefined): Period {
  const n = Number(v);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

export type Delta = { kind: "up" | "down" | "same" | "new" | "none"; pct: number | null };

/** Variação em relação ao período anterior. "new" = não havia nada antes; "none" = nada em nenhum dos dois. */
export function delta(cur: number, prev: number): Delta {
  if (cur === 0 && prev === 0) return { kind: "none", pct: null };
  if (prev === 0) return { kind: "new", pct: null };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { kind: pct > 0 ? "up" : pct < 0 ? "down" : "same", pct };
}

export function deltaText(d: Delta, days: number): string {
  const ref = `vs. ${days} dias anteriores`;
  switch (d.kind) {
    case "up": return `▲ ${d.pct}% ${ref}`;
    case "down": return `▼ ${Math.abs(d.pct!)}% ${ref}`;
    case "same": return `= igual ${ref}`;
    case "new": return "✨ primeiros dados (ainda sem período anterior)";
    default: return "sem dados ainda";
  }
}

/** Topo "redondo" do eixo (1, 2, 5, 10, 20, 50…) para o gráfico. */
export function niceMax(max: number): number {
  if (max <= 4) return Math.max(max, 1);
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 5, 10]) if (max <= m * exp) return m * exp;
  return 10 * exp;
}

/** "2026-11-19" → "19/11" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** "2026-11-19" → "qui, 19/11" (usa meio-dia UTC para não escorregar de dia por fuso) */
export function longDate(iso: string): string {
  const wd = WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${wd}, ${shortDate(iso)}`;
}
