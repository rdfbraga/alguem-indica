"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

async function resizeImage(file: File, max = 800): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("resize"))), "image/jpeg", 0.85));
}

/** Envia a foto (reduzida) ao Storage e guarda o endereço no campo escondido `photo_url`. */
export function PhotoField({
  userId,
  initialUrl = "",
  onBusyChange,
}: {
  userId: string;
  initialUrl?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [photoUrl, setPhotoUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    onBusyChange?.(true);
    setError("");
    try {
      const blob = await resizeImage(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("provider-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      setPhotoUrl(supabase.storage.from("provider-photos").getPublicUrl(path).data.publicUrl);
    } catch {
      setError("Não foi possível enviar a foto. Você pode continuar sem ela.");
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div>
      <label className="label" htmlFor="photo">Foto (opcional)</label>
      {photoUrl && (
        <div className="mb-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-100" />
          <button type="button" onClick={() => setPhotoUrl("")} className="text-sm font-semibold text-sky-brand underline">Remover foto</button>
        </div>
      )}
      <input id="photo" type="file" accept="image/*" onChange={onPhoto} className="block w-full text-sm" />
      {uploading && <p className="mt-1 text-sm text-navy/60">Enviando foto…</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <input type="hidden" name="photo_url" value={photoUrl} />
    </div>
  );
}
