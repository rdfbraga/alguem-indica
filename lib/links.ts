/** Instagram: aceita "@fulano", "fulano" ou o link do perfil. Devolve só o usuário (sem @). */
export function normalizeInstagram(input: string): { ok: true; value: string | null } | { ok: false } {
  let s = input.trim();
  if (!s) return { ok: true, value: null };
  const fromUrl = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([A-Za-z0-9._]+)\/?(?:[?#].*)?$/i.exec(s);
  if (fromUrl) s = fromUrl[1];
  s = s.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? { ok: true, value: s } : { ok: false };
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle}`;
}

/** Site: aceita com ou sem "https://". Só http/https, com domínio, sem espaços, até 200 caracteres. */
export function normalizeWebsite(input: string): { ok: true; value: string | null } | { ok: false } {
  const s = input.trim();
  if (!s) return { ok: true, value: null };
  if (/\s/.test(s)) return { ok: false };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return { ok: false };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false };
  if (!u.hostname.includes(".") || u.username || u.password) return { ok: false };
  const out = u.toString();
  return out.length >= 10 && out.length <= 200 ? { ok: true, value: out } : { ok: false };
}

/** Texto curto para mostrar o site (sem https:// nem barra final). */
export function websiteLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
