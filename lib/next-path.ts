/**
 * Destino "para onde voltar depois do login". Só aceita caminhos DENTRO do mesmo condomínio
 * (`/c/<slug>` ou abaixo); qualquer outra coisa vira a home do condomínio. Evita redirecionamento para fora do site.
 */
export function condoNext(slug: string, raw: string | null | undefined): string {
  const home = `/c/${slug}`;
  if (!raw) return home;
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\r\n]/.test(raw) || raw.includes("..")) return home;
  const path = raw.split(/[?#]/)[0];
  return path === home || path.startsWith(`${home}/`) ? raw : home;
}

/** Acrescenta ?next= a um caminho (só quando o destino não é a home do condomínio). */
export function withNext(path: string, slug: string, next: string | null | undefined): string {
  const n = condoNext(slug, next);
  return n === `/c/${slug}` ? path : `${path}?next=${encodeURIComponent(n)}`;
}
