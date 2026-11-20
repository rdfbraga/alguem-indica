"use client";
import Link from "next/link";
import { useState } from "react";

type Row = { id: string; name: string; category_name: string; hidden: boolean; reason: string | null };

/** Lista de duplicidades com seleção em lote: "Está ok" ou "Ocultar" nos marcados. */
export function FlaggedList({
  slug,
  rows,
  onOk,
  onHide,
}: {
  slug: string;
  rows: Row[];
  onOk: (fd: FormData) => Promise<void>;
  onHide: (fd: FormData) => Promise<void>;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const all = sel.size === rows.length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <form className="space-y-3">
      <div className="sticky top-16 z-[5] flex flex-wrap items-center gap-2 rounded-2xl bg-sky-soft p-2 text-sm">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} className="h-5 w-5" />
          Selecionar todas
        </label>
        <span className="text-navy/60">{sel.size} marcada(s)</span>
        <span className="flex-1" />
        <button formAction={onOk} disabled={sel.size === 0} className="btn !px-3 !py-2 !text-sm disabled:opacity-40">✔ Está ok</button>
        <button formAction={onHide} disabled={sel.size === 0} className="btn-secondary !px-3 !py-2 !text-sm disabled:opacity-40">Ocultar</button>
      </div>
      {rows.map((p) => (
        <label key={p.id} className="card flex cursor-pointer items-start gap-3 !p-3">
          <input type="checkbox" name="id" value={p.id} checked={sel.has(p.id)} onChange={() => toggle(p.id)} className="mt-1 h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <Link href={`/c/${slug}/p/${p.id}`} className="font-semibold underline">{p.name}</Link>
            <span className="text-sm text-navy/60"> · {p.category_name}{p.hidden ? " · OCULTO" : ""}</span>
            <span className="block text-sm text-amber-800">{p.reason}</span>
          </span>
        </label>
      ))}
    </form>
  );
}
