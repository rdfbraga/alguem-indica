type ReviewLike = { author_label: string; author_origin?: string | null };
type ProviderLike = { condo_id: string; condo_name?: string | null };

/**
 * Como mostrar o autor de uma avaliação. O bloco só aparece para quem é do mesmo condomínio do prestador;
 * para quem vem de fora aparece o nome do condomínio. (Autores de outro condomínio já são gravados sem bloco.)
 */
export function reviewAuthorLabel(r: ReviewLike, provider: ProviderLike, viewerCondoId: string): string {
  if (r.author_origin) return r.author_label;
  if (provider.condo_id === viewerCondoId) return r.author_label;
  const short = r.author_label.split(" · ")[0];
  return `${short} · ${provider.condo_name ?? "Condomínio vizinho"}`;
}
