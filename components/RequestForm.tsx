"use client";
import { useActionState } from "react";
import { requestIndication } from "@/app/c/[slug]/actions";
import type { FormState } from "@/lib/types";

/** Pedido de indicação. Com `label`, é só um botão (usado quando a busca não achou ninguém); sem, tem um campo para escrever. */
export function RequestForm({ slug, label, cta = "🙋 Pedir indicação aos vizinhos" }: { slug: string; label?: string; cta?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestIndication.bind(null, slug), undefined);
  return (
    <form action={action} className="space-y-2">
      {label !== undefined ? (
        <input type="hidden" name="label" value={label} />
      ) : (
        <div>
          <label className="label !text-xs" htmlFor="req-label">Que tipo de profissional você procura?</label>
          <input id="req-label" name="label" required minLength={2} maxLength={60} className="input !py-2" placeholder="Ex.: Tapeceiro, Eletricista de ar-condicionado…" />
        </div>
      )}
      {label !== undefined && <input type="hidden" name="notify" value="on" />}
      {label === undefined && !state?.ok && (
        <label className="flex items-start gap-2 text-sm text-navy/80">
          <input type="checkbox" name="notify" defaultChecked className="mt-0.5 h-5 w-5 shrink-0" />
          <span>🔔 Me avisar por e-mail quando alguém indicar</span>
        </label>
      )}
      {state?.error && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-green-700">{state.ok}</p>}
      {!state?.ok && <button disabled={pending} className="btn !px-4 !py-2 !text-sm">{pending ? "Enviando…" : cta}</button>}
    </form>
  );
}
