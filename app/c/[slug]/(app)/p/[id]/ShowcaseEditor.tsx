"use client";
import { useActionState, useState } from "react";
import { addGalleryPhoto, removeGalleryPhoto, saveShowcase } from "../../../actions";
import { PhotoField } from "@/components/PhotoField";
import type { FormState, PhotoRow, ServiceRow } from "@/lib/types";

type Row = { key: number; title: string; price: string; desc: string };
const MAX_SERVICES = 12;
const MAX_PHOTOS = 6;

/** Editor da vitrine do dono: horários, lista de serviços com preços e galeria de fotos. */
export function ShowcaseEditor({
  slug,
  providerId,
  userId,
  initialHours,
  initialServices,
  photos,
}: {
  slug: string;
  providerId: string;
  userId: string;
  initialHours: string;
  initialServices: ServiceRow[];
  photos: PhotoRow[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveShowcase.bind(null, slug, providerId), undefined);
  const [rows, setRows] = useState<Row[]>(
    initialServices.map((s, i) => ({ key: i, title: s.title, price: s.price_text ?? "", desc: s.description ?? "" })),
  );
  const [next, setNext] = useState(initialServices.length);
  const [photoState, photoAction, photoPending] = useActionState<FormState, FormData>(addGalleryPhoto.bind(null, slug, providerId), undefined);
  const [busy, setBusy] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);

  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  return (
    <div className="mt-3 space-y-5">
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="sv-hours">Horários de atendimento</label>
          <textarea id="sv-hours" name="hours" rows={3} maxLength={300} defaultValue={initialHours} className="input" placeholder={"Seg a sex: 8h às 18h\nSáb: 8h às 12h"} />
        </div>

        <div className="space-y-3">
          <span className="label">Serviços e preços ({rows.length}/{MAX_SERVICES})</span>
          {rows.map((r) => (
            <div key={r.key} className="space-y-2 rounded-2xl border border-navy/10 p-3">
              <input name="svc_title" value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} maxLength={80} className="input" placeholder="Serviço (ex.: Troca de tomada)" aria-label="Nome do serviço" />
              <div className="grid grid-cols-2 gap-2">
                <input name="svc_price" value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} maxLength={40} className="input" placeholder="Ex.: R$ 80" aria-label="Preço" />
                <input name="svc_desc" value={r.desc} onChange={(e) => update(r.key, { desc: e.target.value })} maxLength={200} className="input" placeholder="Detalhe" aria-label="Detalhe do serviço" />
              </div>
              <button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="text-xs font-semibold text-red-700 underline">Remover serviço</button>
            </div>
          ))}
          {rows.length < MAX_SERVICES && (
            <button type="button" onClick={() => { setRows((r) => [...r, { key: next, title: "", price: "", desc: "" }]); setNext(next + 1); }} className="btn-secondary !px-3 !py-2 !text-sm">
              ＋ Adicionar serviço
            </button>
          )}
        </div>

        {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">{state.ok}</p>}
        <button disabled={pending} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : "Salvar horários e serviços"}</button>
      </form>

      <div className="space-y-3 border-t border-navy/10 pt-4">
        <span className="label">Galeria de fotos ({photos.length}/{MAX_PHOTOS})</span>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((ph) => (
              <div key={ph.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.caption ?? "Foto"} className="aspect-square w-full rounded-2xl object-cover" />
                <form action={removeGalleryPhoto.bind(null, slug, ph.id)}>
                  <button className="text-xs font-semibold text-red-700 underline">Remover</button>
                </form>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <form
            key={photoKey}
            action={async (fd) => { await photoAction(fd); setPhotoKey((k) => k + 1); }}
            className="space-y-2"
          >
            <PhotoField userId={userId} onBusyChange={setBusy} label="Nova foto" name="gallery_url" />
            <input name="caption" maxLength={80} className="input" placeholder="Legenda (opcional)" />
            {photoState?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{photoState.error}</p>}
            {photoState?.ok && <p className="text-sm font-semibold text-green-700">{photoState.ok}</p>}
            <button disabled={busy || photoPending} className="btn-secondary !px-3 !py-2 !text-sm">{photoPending ? "Adicionando…" : "Adicionar foto"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
