"use client";
import { useState } from "react";
import type { Category } from "@/lib/types";
import type { GroupLike, Section } from "@/lib/groups";
import { MAX_CATEGORIES } from "@/lib/categories";

/** Escolha de 1 a 3 categorias. A primeira é a principal; as demais são "também atende". */
export function CategoryPicker({
  sections,
  value,
  onChange,
  max = MAX_CATEGORIES,
}: {
  sections: Section<GroupLike, Category>[];
  value: number[];
  onChange: (v: number[]) => void;
  max?: number;
}) {
  const all = sections.flatMap((s) => s.categories);
  const byId = new Map(all.map((c) => [c.id, c]));
  const full = value.length >= max;
  const [groupId, setGroupId] = useState<number | "">("");
  const other = byId.size ? all.find((c) => c.slug === "outros") : undefined;   // "Outros": é por onde se sugere uma categoria nova
  const nameOf = (c: Category) => (c.slug === "outros" ? "Outra categoria (sugerir)" : c.name);
  const suggest = () => {
    if (!other || value.includes(other.id) || full) return;
    onChange([...value, other.id]);
    setGroupId("");
  };
  const section = sections.find((s) => s.group.id === groupId);
  const options = section ? section.categories.filter((c) => !value.includes(c.id)) : [];

  return (
    <div className="space-y-2">
      {value.map((id, i) => {
        const c = byId.get(id);
        if (!c) return null;
        return (
          <div key={id} className="flex items-center gap-2 rounded-2xl border-2 border-brand-100 bg-brand-50 px-3 py-2">
            <input type="hidden" name="category_id" value={id} />
            <span className="flex-1 text-sm font-bold">
              {c.icon} {nameOf(c)}
              {i === 0 && <span className="ml-2 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">principal</span>}
            </span>
            {i > 0 && (
              <button type="button" onClick={() => onChange([id, ...value.filter((x) => x !== id)])} className="text-xs font-semibold text-sky-brand underline">
                tornar principal
              </button>
            )}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Remover ${nameOf(c)}`} className="px-1 text-lg leading-none text-navy/50 hover:text-navy">
              ×
            </button>
          </div>
        );
      })}
      {!full && (
        <div className="space-y-2">
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value === "" ? "" : Number(e.target.value))}
            className="input"
            aria-label="Tipo de serviço"
          >
            <option value="">{value.length === 0 ? "1. Escolha o tipo de serviço…" : "＋ Também atende outro tipo de serviço?"}</option>
            {sections.map((sec) => (
              <option key={sec.group.id} value={sec.group.id}>{sec.group.icon} {sec.group.name}</option>
            ))}
          </select>
          {section && (
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                onChange([...value, Number(e.target.value)]);
                setGroupId("");
              }}
              className="input"
              aria-label="Escolher a categoria"
              autoFocus
            >
              <option value="">2. Escolha a categoria…</option>
              {options.map((c) => <option key={c.id} value={c.id}>{c.icon} {nameOf(c)}</option>)}
            </select>
          )}
          {other && !value.includes(other.id) && (
            <button type="button" onClick={suggest} className="w-full rounded-2xl border-2 border-dashed border-brand-500/60 bg-brand-50/60 p-3 text-left text-sm transition hover:bg-brand-50">
              <b className="text-brand-700">🔎 Não achou a categoria? Sugira uma nova</b>
              <span className="mt-0.5 block text-navy/70">Escreva qual é o serviço. O perfil já entra no ar e a administração cria a categoria se fizer sentido.</span>
            </button>
          )}
        </div>
      )}
      {full && <p className="text-xs text-navy/60">Máximo de {max} categorias por perfil.</p>}
    </div>
  );
}
