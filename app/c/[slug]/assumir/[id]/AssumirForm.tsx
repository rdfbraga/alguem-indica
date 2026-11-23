"use client";
import { useActionState } from "react";
import { becomeProviderAndClaim } from "../../actions";
import type { FormState } from "@/lib/types";

/** Prestador que não mora no condomínio: só o nome, os termos e pronto. Não pede bloco nem unidade. */
export function AssumirForm({ slug, providerId, defaultName }: { slug: string; providerId: string; defaultName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(becomeProviderAndClaim.bind(null, slug, providerId), undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="full_name">Seu nome (ou do seu negócio)</label>
        <input id="full_name" name="full_name" required minLength={2} maxLength={80} defaultValue={defaultName} className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" required className="mt-1 h-4 w-4" />
        <span>Li e aceito os <a href="/termos" className="underline" target="_blank">Termos de Uso</a> e a <a href="/privacidade" className="underline" target="_blank">Política de Privacidade</a>.</span>
      </label>
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn w-full">{pending ? "Enviando…" : "Pedir para assumir meu perfil"}</button>
    </form>
  );
}
