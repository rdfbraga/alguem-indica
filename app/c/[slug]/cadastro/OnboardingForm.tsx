"use client";
import { useActionState } from "react";
import { completeOnboarding } from "../actions";
import type { FormState } from "@/lib/types";

export function OnboardingForm({ slug, defaultName, next }: { slug: string; defaultName: string; next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(completeOnboarding.bind(null, slug), undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="full_name">Nome completo</label>
        <input id="full_name" name="full_name" required defaultValue={defaultName} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="block">Bloco / Torre</label>
          <input id="block" name="block" required maxLength={20} className="input" placeholder="B" />
        </div>
        <div>
          <label className="label" htmlFor="unit">Unidade</label>
          <input id="unit" name="unit" required maxLength={20} className="input" placeholder="204" />
        </div>
      </div>
      <p className="text-xs text-navy/60">
        Seu nome e unidade <b>não</b> ficam públicos. Nas avaliações aparece só seu primeiro nome, a inicial do sobrenome e o bloco.
      </p>
      <label className="flex items-start gap-2 rounded-2xl bg-sky-soft p-3 text-sm">
        <input type="checkbox" name="offers_service" className="mt-1 h-4 w-4" />
        <span><b>Também ofereço algum serviço aos vizinhos</b> (opcional). Depois de entrar, você cadastra seu perfil.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" className="mt-1 h-4 w-4" />
        <span>
          Li e aceito os <a href="/termos" target="_blank" className="underline">Termos</a> e a{" "}
          <a href="/privacidade" target="_blank" className="underline">Política de Privacidade</a>.
        </span>
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn w-full">{pending ? "Salvando…" : "Entrar no condomínio"}</button>
    </form>
  );
}
