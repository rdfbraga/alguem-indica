"use client";
import { useActionState } from "react";
import { requestProfileClaim } from "../../../actions";
import type { FormState } from "@/lib/types";

export function ClaimProfile({ slug, providerId, defaultOpen = false }: { slug: string; providerId: string; defaultOpen?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestProfileClaim.bind(null, slug, providerId), undefined);
  if (state?.ok) return <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">{state.ok}</p>;
  return (
    <details open={defaultOpen} className="rounded-2xl border border-navy/10 p-3">
      <summary className="cursor-pointer text-sm font-bold text-sky-brand">🙋 Este perfil é meu</summary>
      <form action={action} className="mt-3 space-y-3">
        <p className="text-sm text-navy/70">
          Se você é este profissional, peça para assumir o perfil. A administração confirma e você passa a ser o dono: só você edita foto, descrição, telefone e categorias.
        </p>
        <div>
          <label className="label" htmlFor="note">Como podemos confirmar que é você? (opcional)</label>
          <textarea id="note" name="note" rows={2} maxLength={300} className="input" placeholder="Ex.: sou do bloco C, apto 22." />
        </div>
        {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        <button disabled={pending} className="btn !px-4 !py-2 !text-sm">{pending ? "Enviando…" : "Pedir para assumir"}</button>
      </form>
    </details>
  );
}
