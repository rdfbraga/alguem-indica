"use client";
import { useActionState } from "react";
import { deleteReviewReply, replyToReview } from "../../../actions";
import type { FormState } from "@/lib/types";

/** Resposta pública do dono a uma avaliação (criar, editar ou apagar). */
export function ReplyBox({ slug, reviewId, initial }: { slug: string; reviewId: string; initial: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(replyToReview.bind(null, slug, reviewId), undefined);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-bold text-sky-brand">{initial ? "✏️ Editar resposta" : "↩️ Responder"}</summary>
      <form action={action} className="mt-2 space-y-2">
        <textarea name="reply" required minLength={2} maxLength={500} rows={3} defaultValue={initial ?? ""} className="input" placeholder="Agradeça ou esclareça. A resposta fica pública." />
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-green-700">{state.ok}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className="btn !px-3 !py-2 !text-sm">{pending ? "Publicando…" : "Publicar resposta"}</button>
        </div>
      </form>
      {initial && (
        <form action={deleteReviewReply.bind(null, slug, reviewId)} className="mt-2">
          <button className="text-xs font-semibold text-red-700 underline">Apagar resposta</button>
        </form>
      )}
    </details>
  );
}
