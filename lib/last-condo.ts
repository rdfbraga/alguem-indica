/** Cookie com o último condomínio acessado (só o identificador do link; a validação de acesso é sempre feita no servidor). */
export const LAST_CONDO_COOKIE = "last_condo";
const SLUG = /^\/c\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$|\?)/;

/** "/c/parque-barueri/p/123" → "parque-barueri". Fora de /c/<slug>, null. */
export function condoSlugFromPath(path: string): string | null {
  const m = SLUG.exec(path);
  return m ? m[1] : null;
}

/** Escolhe para onde levar quem abre a página inicial: o último condomínio, se a pessoa ainda é moradora dele; senão o único dela. */
export function pickCondo(slugs: string[], last: string | null | undefined): string | null {
  if (last && slugs.includes(last)) return last;
  return slugs.length === 1 ? slugs[0] : null;
}
