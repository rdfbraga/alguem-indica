"use client";
import { useActionState } from "react";
import { reportItem } from "@/app/c/[slug]/actions";
import type { FormState } from "@/lib/types";

export function ReportButton({
  slug,
  target,
  id,
}: {
  slug: string;
  target: "provider" | "review";
  id: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(reportItem.bind(null, slug), undefined);
  return (
    <details className="text-sm text-stone-500">
      <summary className="cursor-pointer select-none hover:text-stone-700">Denunciar</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="target" value={target} />
        <input type="hidden" name="id" value={id} />
        <input name="reason" required minLength={3} maxLength={300} placeholder="Qual é o problema?" className="input !py-2 !text-sm" />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-brand-700">{state.ok}</p>}
        <button disabled={pending} className="btn-secondary !px-3 !py-2 !text-sm">
          {pending ? "Enviando…" : "Enviar denúncia"}
        </button>
      </form>
    </details>
  );
}
