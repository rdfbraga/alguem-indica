"use client";
import { useActionState, useState } from "react";
import { updateProviderProfile } from "../../../actions";
import { PhotoField } from "@/components/PhotoField";
import { formatWhatsapp } from "@/lib/phone";
import type { FormState } from "@/lib/types";

export function EditProfile({
  slug,
  providerId,
  userId,
  initial,
}: {
  slug: string;
  providerId: string;
  userId: string;
  initial: { name: string; description: string; whatsapp: string; photo_url: string | null };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProviderProfile.bind(null, slug, providerId), undefined);
  const [busy, setBusy] = useState(false);
  return (
    <form action={action} className="mt-3 space-y-3">
      <div>
        <label className="label" htmlFor="ep-name">Nome</label>
        <input id="ep-name" name="name" required minLength={2} maxLength={80} defaultValue={initial.name} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="ep-whatsapp">WhatsApp</label>
        <input id="ep-whatsapp" name="whatsapp" required inputMode="tel" defaultValue={formatWhatsapp(initial.whatsapp)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="ep-desc">Descrição</label>
        <textarea id="ep-desc" name="description" rows={4} maxLength={500} defaultValue={initial.description} className="input" placeholder="O que você faz, horários, diferenciais…" />
      </div>
      <PhotoField userId={userId} initialUrl={initial.photo_url ?? ""} onBusyChange={setBusy} />
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">{state.ok}</p>}
      <button disabled={pending || busy} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : "Salvar perfil"}</button>
    </form>
  );
}
