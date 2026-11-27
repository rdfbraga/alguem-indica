/** Endereço de imagem aceito: precisa ser do Storage público do projeto, no bucket certo (nada de imagem de outro site). */
export function isStorageImageUrl(url: string, bucket: "provider-photos" | "ad-images", supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (!supabaseUrl) return false;
  const base = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/`;
  if (!url.startsWith(base)) return false;
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(url.slice(base.length));
}

/** Caminho do arquivo dentro do bucket (para apagá-lo), ou null se o endereço não for do Storage do projeto. */
export function storagePathFromUrl(url: string, bucket: "provider-photos" | "ad-images", supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  return isStorageImageUrl(url, bucket, supabaseUrl)
    ? url.slice(`${supabaseUrl!.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/`.length)
    : null;
}
