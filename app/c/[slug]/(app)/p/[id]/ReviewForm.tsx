"use client";
import { useActionState, useState } from "react";
import { submitReview } from "../../../actions";
import type { FormState } from "@/lib/types";

export function ReviewForm({ slug, providerId }: { slug: string; providerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitReview.bind(null, slug, providerId),
    undefined,
  );
  const [rating, setRating] = useState(0);
  if (state?.ok) return <p className="card text-center font-medium text-brand-700">{state.ok}</p>;
  return (
    <form action={action} className="card space-y-3">
      <div className="font-semibold">Avalie este profissional</div>
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1 text-3xl" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`}
            className={n <= rating ? "text-amber-500" : "text-stone-300"}>★</button>
        ))}
      </div>
      <textarea name="comment" maxLength={600} rows={3} className="input" placeholder="Conte como foi (opcional)" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending || rating === 0} className="btn w-full">{pending ? "Enviando…" : "Enviar avaliação"}</button>
    </form>
  );
}
