"use client";
import { useActionState, useState } from "react";
import { updateProviderCategories } from "../../../actions";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { Category, FormState } from "@/lib/types";
import type { GroupLike, Section } from "@/lib/groups";

export function EditCategories({
  slug,
  providerId,
  sections,
  initialIds,
  initialCustom,
}: {
  slug: string;
  providerId: string;
  sections: Section<GroupLike, Category>[];
  initialIds: number[];
  initialCustom: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateProviderCategories.bind(null, slug, providerId),
    undefined,
  );
  const [ids, setIds] = useState<number[]>(initialIds);
  const hasOther = sections.flatMap((s) => s.categories).some((c) => ids.includes(c.id) && c.slug === "outros");

  return (
    <form action={action} className="mt-3 space-y-3">
      <CategoryPicker sections={sections} value={ids} onChange={setIds} />
      {hasOther && (
        <div>
          <label className="label" htmlFor="custom_category">Qual serviço em “Outros”?</label>
          <input id="custom_category" name="custom_category" defaultValue={initialCustom} required minLength={2} maxLength={40} className="input" placeholder="Ex.: Costureira" />
        </div>
      )}
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">{state.ok}</p>}
      <button disabled={pending || ids.length === 0} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : "Salvar categorias"}</button>
    </form>
  );
}
