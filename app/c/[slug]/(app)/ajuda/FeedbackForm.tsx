"use client";
import { useActionState, useState } from "react";
import { submitFeedback } from "../../actions";
import { FEEDBACK_KINDS, MESSAGE_MAX, type FeedbackKind } from "@/lib/feedback";
import type { FormState } from "@/lib/types";

export function FeedbackForm({
  slug,
  defaultContact,
  defaultKind = "suporte",
  defaultMessage = "",
}: {
  slug: string;
  defaultContact: string;
  defaultKind?: FeedbackKind;
  defaultMessage?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitFeedback.bind(null, slug), undefined);
  const [kind, setKind] = useState<FeedbackKind>(defaultKind);
  const [text, setText] = useState(defaultMessage);

  if (state?.ok) {
    return (
      <div className="card space-y-3 text-center">
        <div className="text-4xl">✅</div>
        <p className="font-bold text-green-700">{state.ok}</p>
        <a href="" className="btn-secondary w-full">Enviar outra mensagem</a>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4">
      <div>
        <span className="label">Sobre o que você quer falar?</span>
        <div className="grid grid-cols-2 gap-2">
          {FEEDBACK_KINDS.map((k) => (
            <label key={k.value} className={`cursor-pointer rounded-2xl border-2 p-2.5 text-sm transition ${kind === k.value ? "border-brand-500 bg-brand-50" : "border-navy/10 bg-white"}`}>
              <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
              <div className="font-bold">{k.icon} {k.label}</div>
              <div className="text-xs text-navy/60">{k.hint}</div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="message">Sua mensagem</label>
        <textarea id="message" name="message" required minLength={5} maxLength={MESSAGE_MAX} rows={5} value={text} onChange={(e) => setText(e.target.value)} className="input" placeholder="Conte com detalhes. Se for um problema, diga em qual tela aconteceu." />
        <div className="mt-1 text-right text-xs text-navy/50">{text.length}/{MESSAGE_MAX}</div>
      </div>
      <div>
        <label className="label" htmlFor="reply_to">Outro contato para resposta (opcional)</label>
        <input id="reply_to" name="reply_to" maxLength={120} defaultValue={defaultContact} className="input" placeholder="E-mail ou WhatsApp" />
        <p className="mt-1 text-xs text-navy/60">Você também verá a resposta aqui nesta página. Só a administração enxerga este contato.</p>
      </div>
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="btn w-full">{pending ? "Enviando…" : "Enviar mensagem"}</button>
    </form>
  );
}
