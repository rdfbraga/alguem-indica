"use client";
import { useActionState, useState } from "react";
import { adminSaveAd } from "../../actions";
import { PhotoField } from "@/components/PhotoField";
import { formatWhatsapp } from "@/lib/phone";
import type { AdRow, FormState } from "@/lib/types";

/** Cria ou edita um anúncio. Precisa de um link OU um WhatsApp para o botão. */
export function AdForm({ slug, userId, ad }: { slug: string; userId: string; ad?: AdRow }) {
  const [state, action, pending] = useActionState<FormState, FormData>(adminSaveAd.bind(null, slug, ad?.id ?? null), undefined);
  const [busy, setBusy] = useState(false);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ad-advertiser">Anunciante</label>
          <input id="ad-advertiser" name="advertiser" required minLength={2} maxLength={60} defaultValue={ad?.advertiser} className="input" placeholder="Pizzaria Boa" />
        </div>
        <div>
          <label className="label" htmlFor="ad-title">Título do anúncio</label>
          <input id="ad-title" name="title" required minLength={2} maxLength={60} defaultValue={ad?.title} className="input" placeholder="Pizza em dobro às terças" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ad-body">Texto (opcional, até 140 caracteres)</label>
        <textarea id="ad-body" name="body" rows={2} maxLength={140} defaultValue={ad?.body ?? ""} className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="ad-cta">Texto do botão</label>
          <input id="ad-cta" name="cta_label" maxLength={24} defaultValue={ad?.cta_label ?? "Saiba mais"} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ad-link">Link (site ou Instagram)</label>
          <input id="ad-link" name="link_url" maxLength={300} inputMode="url" defaultValue={ad?.link_url ?? ""} className="input" placeholder="www.loja.com.br" autoCapitalize="none" />
        </div>
        <div>
          <label className="label" htmlFor="ad-wa">ou WhatsApp</label>
          <input id="ad-wa" name="whatsapp" inputMode="tel" defaultValue={ad?.whatsapp ? formatWhatsapp(ad.whatsapp) : ""} className="input" placeholder="(11) 99999-8888" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ad-start">Começa em (opcional)</label>
          <input id="ad-start" type="date" name="starts_on" defaultValue={ad?.starts_on ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ad-end">Termina em (opcional)</label>
          <input id="ad-end" type="date" name="ends_on" defaultValue={ad?.ends_on ?? ""} className="input" />
        </div>
      </div>
      <PhotoField userId={userId} bucket="ad-images" name="image_url" label="Imagem ou logo (opcional)" initialUrl={ad?.image_url ?? ""} onBusyChange={setBusy} />
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">{state.ok}</p>}
      <button disabled={pending || busy} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : ad ? "Salvar anúncio" : "Criar anúncio"}</button>
    </form>
  );
}
