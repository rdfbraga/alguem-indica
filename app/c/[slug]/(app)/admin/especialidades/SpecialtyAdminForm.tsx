"use client";
import { useActionState } from "react";
import { adminSaveSpecialty } from "../../../actions";
import type { Category, FormState } from "@/lib/types";
import type { GroupLike, Section } from "@/lib/groups";

/** Cria (sem `specialty`) ou edita uma especialidade. Ao editar, a categoria não muda. */
export function SpecialtyAdminForm({
  slug,
  sections,
  specialty,
}: {
  slug: string;
  sections: Section<GroupLike, Category>[];
  specialty?: { id: number; category_id: number; name: string; keywords: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(adminSaveSpecialty.bind(null, slug, specialty?.id ?? null), undefined);
  const k = specialty ? `e${specialty.id}` : "novo";
  return (
    <form action={action} className="space-y-2">
      {specialty ? (
        <input type="hidden" name="category_id" value={specialty.category_id} />
      ) : (
        <div>
          <label className="label !text-xs" htmlFor={`${k}-cat`}>Categoria</label>
          <select id={`${k}-cat`} name="category_id" required defaultValue="" className="input !py-2">
            <option value="" disabled>Escolha…</option>
            {sections.map((sec) => (
              <optgroup key={sec.group.id} label={`${sec.group.icon} ${sec.group.name}`}>
                {sec.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label !text-xs" htmlFor={`${k}-name`}>Nome da especialidade</label>
        <input id={`${k}-name`} name="name" required minLength={2} maxLength={60} defaultValue={specialty?.name} className="input !py-2" placeholder="Ex.: Medicina do sono" />
      </div>
      <div>
        <label className="label !text-xs" htmlFor={`${k}-kw`}>Palavras para a busca (sinônimos, opcional)</label>
        <input id={`${k}-kw`} name="keywords" maxLength={300} defaultValue={specialty?.keywords} className="input !py-2" placeholder="Ex.: sono insônia apneia" />
      </div>
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-green-700">{state.ok}</p>}
      <button disabled={pending} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : specialty ? "Salvar" : "Criar especialidade"}</button>
    </form>
  );
}
