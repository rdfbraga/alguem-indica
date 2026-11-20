"use client";
import type { Category } from "@/lib/types";
import { MAX_SPECIALTIES, type Specialty } from "@/lib/specialties";

/**
 * Escolha de especialidades (até 5), só para as categorias do perfil que têm especialidades.
 * Envia as escolhidas em campos escondidos e o texto livre em "custom_specialty".
 */
export function SpecialtyPicker({
  specialties,
  categories,
  categoryIds,
  value,
  onChange,
  customDefault = "",
}: {
  specialties: Specialty[];
  categories: Category[];
  categoryIds: number[];
  value: number[];
  onChange: (v: number[]) => void;
  customDefault?: string;
}) {
  const groups = categoryIds
    .map((id) => ({ cat: categories.find((c) => c.id === id), items: specialties.filter((s) => s.category_id === id) }))
    .filter((g) => g.cat && g.items.length > 0);
  if (groups.length === 0) return null;

  const valid = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  const selected = value.filter((v) => valid.has(v));
  const full = selected.length >= MAX_SPECIALTIES;
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : full ? selected : [...selected, id]);

  return (
    <div className="space-y-3 rounded-2xl border border-navy/10 p-3">
      <input type="hidden" name="has_specialties" value="1" />
      {selected.map((id) => <input key={id} type="hidden" name="specialty_id" value={id} />)}
      <div className="flex items-baseline justify-between gap-2">
        <span className="label !mb-0">Especialidades <span className="font-normal text-navy/55">(opcional)</span></span>
        <span className="text-xs text-navy/55">{selected.length}/{MAX_SPECIALTIES}</span>
      </div>
      <p className="text-xs text-navy/60">Ajuda os vizinhos a achar exatamente o que procuram.</p>
      {groups.map((g) => (
        <div key={g.cat!.id}>
          {groups.length > 1 && <div className="mb-1 text-xs font-bold text-navy/70">{g.cat!.icon} {g.cat!.name}</div>}
          <div className="flex flex-wrap gap-2">
            {g.items.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(s.id)}
                  className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition disabled:opacity-40 ${on ? "border-brand-500 bg-brand-500 text-white" : "border-navy/15 bg-white text-navy hover:border-sky-brand/50"}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <label className="label !text-xs" htmlFor="custom_specialty">Outra especialidade (se não estiver na lista)</label>
        <input id="custom_specialty" name="custom_specialty" maxLength={40} defaultValue={customDefault} className="input !py-2" placeholder="Ex.: Alergia infantil" />
      </div>
    </div>
  );
}
