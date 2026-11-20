"use client";
import Link from "next/link";
import { useState } from "react";

export type ProfileRow = {
  id: string;
  name: string;
  photo_url: string | null;
  category: string;
  icon: string;
  condo: string;
  condoSlug: string;
  hidden: boolean;
  flagged: boolean;
  flagReason: string | null;
  owner: "confirmed" | "pending" | "none";
  kind: "resident" | "external";
  rating: number;
  reviews: number;
  whatsapp: string;
  clicks: number | null;
  createdAt: string;
};

const OWNER: Record<ProfileRow["owner"], { label: string; cls: string }> = {
  confirmed: { label: "✅ Dono confirmado", cls: "bg-green-50 text-green-700" },
  pending: { label: "⏳ Aguardando confirmação", cls: "bg-amber-50 text-amber-800" },
  none: { label: "Sem dono", cls: "bg-navy/10 text-navy/60" },
};

/** Lista de perfis com seleção em lote. As ações chegam prontas do servidor. */
export function ProfilesList({
  rows,
  showCondo,
  onHide,
  onShow,
  onOk,
}: {
  rows: ProfileRow[];
  showCondo: boolean;
  onHide: (fd: FormData) => Promise<void>;
  onShow: (fd: FormData) => Promise<void>;
  onOk: (fd: FormData) => Promise<void>;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const all = rows.length > 0 && sel.size === rows.length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <form className="space-y-3">
      <div className="sticky top-16 z-[5] flex flex-wrap items-center gap-2 rounded-2xl bg-sky-soft p-2 text-sm">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} className="h-5 w-5" />
          Todos desta página
        </label>
        <span className="text-navy/60">{sel.size} marcado(s)</span>
        <span className="flex-1" />
        <button formAction={onHide} disabled={sel.size === 0} className="btn-secondary !px-3 !py-2 !text-sm disabled:opacity-40">Ocultar</button>
        <button formAction={onShow} disabled={sel.size === 0} className="btn-secondary !px-3 !py-2 !text-sm disabled:opacity-40">Reexibir</button>
        <button formAction={onOk} disabled={sel.size === 0} className="btn-secondary !px-3 !py-2 !text-sm disabled:opacity-40">✔ Está ok</button>
      </div>
      {rows.map((r) => (
        <label key={r.id} className={`card flex cursor-pointer items-start gap-3 !p-3 ${r.hidden ? "opacity-70" : ""}`}>
          <input type="checkbox" name="id" value={r.id} checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="mt-1 h-5 w-5 shrink-0" />
          {r.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-brand-100" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl ring-2 ring-brand-100">{r.icon}</span>
          )}
          <span className="min-w-0 flex-1 space-y-1">
            <span className="block">
              <Link href={`/c/${r.condoSlug}/p/${r.id}`} className="font-extrabold underline">{r.name}</Link>
              {r.hidden && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 align-middle text-[10px] font-bold text-red-700">OCULTO</span>}
            </span>
            <span className="block truncate text-sm text-navy/60">
              {r.category} · {r.kind === "resident" ? "Morador" : "Externo"}{showCondo ? ` · 📍 ${r.condo}` : ""}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-bold ${OWNER[r.owner].cls}`}>{OWNER[r.owner].label}</span>
              {r.flagged && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-900" title={r.flagReason ?? undefined}>⚠️ Inconsistência</span>}
              <span className="text-navy/65">{r.reviews > 0 ? `★ ${r.rating.toFixed(1)} (${r.reviews})` : "Sem avaliações"}</span>
              {r.clicks !== null && <span className="text-navy/65">· {r.clicks} {r.clicks === 1 ? "clique" : "cliques"} em 30 dias</span>}
            </span>
            <span className="block text-xs text-navy/50">{r.whatsapp} · cadastrado em {new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
          </span>
        </label>
      ))}
    </form>
  );
}
