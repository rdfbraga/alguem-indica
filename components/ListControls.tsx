import Link from "next/link";
import { KIND_LABELS, ORDER_LABELS, type Kind, type Order } from "@/lib/listing";

function href(base: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      replace
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`whitespace-nowrap rounded-full border-2 px-3 py-1 text-sm font-bold transition ${
        active ? "border-brand-500 bg-brand-500 text-white" : "border-navy/15 bg-white text-navy hover:border-sky-brand/50"
      }`}
    >
      {children}
    </Link>
  );
}

/** Chips de ordenação e filtro. Tudo via URL, sem JavaScript no cliente. */
export function ListControls({
  base,
  q,
  order,
  kind,
  orders,
  extra,
}: {
  base: string;
  q?: string;
  order: Order;
  kind: Kind;
  orders: Order[];
  /** Outros parâmetros da URL a manter (ex.: a especialidade escolhida). */
  extra?: Record<string, string | undefined>;
}) {
  const tipoParam = (k: Kind) => (k === "todos" ? undefined : k);
  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Ordenar por">
        {orders.map((o) => (
          <Chip key={o} to={href(base, { ...extra, q, ordem: o, tipo: tipoParam(kind) })} active={o === order}>
            {ORDER_LABELS[o]}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por tipo">
        {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
          <Chip key={k} to={href(base, { ...extra, q, ordem: order, tipo: tipoParam(k) })} active={k === kind}>
            {KIND_LABELS[k]}
          </Chip>
        ))}
      </div>
    </div>
  );
}
