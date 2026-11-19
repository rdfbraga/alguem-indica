"use client";
import { useActionState, useState } from "react";
import { createProvider } from "../../actions";
import { createClient } from "@/lib/supabase/client";
import type { Category, FormState } from "@/lib/types";

async function resizeImage(file: File, max = 800): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize"))), "image/jpeg", 0.85));
}

export function ProviderForm({
  slug,
  categories,
  userId,
  defaultBlock,
}: {
  slug: string;
  categories: Category[];
  userId: string;
  defaultBlock: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createProvider.bind(null, slug), undefined);
  const [kind, setKind] = useState<"resident" | "external">("external");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setPhotoError("");
    try {
      const blob = await resizeImage(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("provider-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setPhotoUrl(supabase.storage.from("provider-photos").getPublicUrl(path).data.publicUrl);
    } catch {
      setPhotoError("Não foi possível enviar a foto. Você pode continuar sem ela.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Nome do profissional</label>
        <input id="name" name="name" required maxLength={80} className="input" placeholder="Ex.: João Silva" />
      </div>
      <div>
        <label className="label" htmlFor="category_id">Categoria</label>
        <select id="category_id" name="category_id" required defaultValue="" className="input">
          <option value="" disabled>Escolha…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div>
        <span className="label">Quem é?</span>
        <div className="grid grid-cols-2 gap-2">
          {([["resident", "Mora aqui"], ["external", "Externo (você indica)"]] as const).map(([v, label]) => (
            <label key={v} className={`card cursor-pointer text-center text-sm ${kind === v ? "!border-brand-500 bg-brand-50 font-semibold" : ""}`}>
              <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </div>
      {kind === "resident" && (
        <div>
          <label className="label" htmlFor="block">Bloco / Torre do profissional</label>
          <input id="block" name="block" defaultValue={defaultBlock} maxLength={20} className="input" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="whatsapp">WhatsApp</label>
        <input id="whatsapp" name="whatsapp" required inputMode="tel" className="input" placeholder="(11) 99999-8888" />
      </div>
      <div>
        <label className="label" htmlFor="description">Descrição (opcional)</label>
        <textarea id="description" name="description" rows={3} maxLength={500} className="input" placeholder="O que ele faz, horários, diferenciais…" />
      </div>
      <div>
        <label className="label" htmlFor="photo">Foto (opcional)</label>
        <input id="photo" type="file" accept="image/*" onChange={onPhoto} className="block w-full text-sm" />
        {uploading && <p className="mt-1 text-sm text-stone-500">Enviando foto…</p>}
        {photoUrl && <p className="mt-1 text-sm text-brand-700">Foto enviada ✓</p>}
        {photoError && <p className="mt-1 text-sm text-red-600">{photoError}</p>}
        <input type="hidden" name="photo_url" value={photoUrl} />
      </div>
      <p className="text-xs text-stone-500">
        Ao indicar, você confirma que tem autorização para divulgar o contato deste profissional. Evite incluir dados pessoais além do WhatsApp.
      </p>
      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending || uploading} className="btn w-full">{pending ? "Publicando…" : "Publicar indicação"}</button>
    </form>
  );
}
