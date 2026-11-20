"use client";
import { useActionState } from "react";
import { adminSaveCategory } from "../../../actions";
import type { Category, CategoryGroup, FormState } from "@/lib/types";

/** Cria (sem `category`) ou edita uma categoria. O link (slug) nunca muda. */
export function CategoryAdminForm({
  slug,
  groups,
  category,
}: {
  slug: string;
  groups: CategoryGroup[];
  category?: Category;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(adminSaveCategory.bind(null, slug, category?.id ?? null), undefined);
  const k = category ? `e${category.id}` : "novo";
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <div className="w-20 shrink-0">
          <label className="label !text-xs" htmlFor={`${k}-icon`}>Ícone</label>
          <input id={`${k}-icon`} name="icon" maxLength={8} defaultValue={category?.icon ?? ""} className="input !py-2 text-center" placeholder="✨" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="label !text-xs" htmlFor={`${k}-name`}>Nome da categoria</label>
          <input id={`${k}-name`} name="name" required minLength={2} maxLength={40} defaultValue={category?.name} className="input !py-2" placeholder="Ex.: Instalador de piso" />
        </div>
      </div>
      <div>
        <label className="label !text-xs" htmlFor={`${k}-group`}>Grupo</label>
        <select id={`${k}-group`} name="group_id" required defaultValue={category?.group_id ?? ""} className="input !py-2">
          <option value="" disabled>Escolha…</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label !text-xs" htmlFor={`${k}-kw`}>Palavras para a busca (sinônimos, opcional)</label>
        <input id={`${k}-kw`} name="keywords" maxLength={400} defaultValue={category?.keywords ?? ""} className="input !py-2" placeholder="Ex.: piso laminado vinílico assoalho" />
      </div>
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-green-700">{state.ok}</p>}
      <button disabled={pending} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : category ? "Salvar" : "Criar categoria"}</button>
    </form>
  );
}
