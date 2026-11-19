"use client";
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

  return (
    <div className="space-y-2">
      {value.map((id, i) => {
        const c = byId.get(id);
        if (!c) return null;
        return (
          <div key={id} className="flex items-center gap-2 rounded-2xl border-2 border-brand-100 bg-brand-50 px-3 py-2">
            <input type="hidden" name="category_id" value={id} />
            <span className="flex-1 text-sm font-bold">
              {c.icon} {c.name}
              {i === 0 && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">principal</span>}
            </span>
            {i > 0 && (
              <button type="button" onClick={() => onChange([id, ...value.filter((x) => x !== id)])} className="text-xs font-semibold text-sky-brand underline">
                tornar principal
              </button>
            )}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Remover ${c.name}`} className="px-1 text-lg leading-none text-navy/50 hover:text-navy">
              ×
            </button>
          </div>
        );
      })}
      {!full && (
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...value, Number(e.target.value)])}
          className="input"
          aria-label={value.length === 0 ? "Escolher a categoria" : "Adicionar outra categoria"}
        >
          <option value="">{value.length === 0 ? "Escolha a categoria…" : "＋ Também atende outro tipo de serviço?"}</option>
          {sections.map((sec) => (
            <optgroup key={sec.group.id} label={`${sec.group.icon} ${sec.group.name}`}>
              {sec.categories.filter((c) => !value.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      {full && <p className="text-xs text-navy/60">Máximo de {max} categorias por perfil.</p>}
    </div>
  );
}
