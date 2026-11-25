import type { AdRow } from "./types";

export type AdPlacement = "home" | "category" | "search";
export const PLACEMENT_LABEL: Record<AdPlacement, string> = {
  home: "Tela inicial",
  category: "Dentro de categorias",
  search: "Nos resultados de busca",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** A busca bate com as palavras do anúncio (iguais, ou com o mesmo começo de 6 letras: "eletricista" ~ "eletrica"). */
export function keywordsMatch(keywords: string | null | undefined, query: string): boolean {
  const k = words(keywords ?? "");
  const q = words(query);
  return k.some((a) => q.some((b) => a === b || commonPrefix(a, b) >= 6));
}

/**
 * Anúncios que podem aparecer num lugar:
 * - tela inicial: os marcados para a tela inicial;
 * - categoria: os marcados para categoria, sem categorias escolhidas (todas) ou com a categoria aberta;
 * - busca: os marcados para busca cujo alvo bate (categoria entre os resultados, ou palavras da busca).
 */
export function adsFor(
  ads: AdRow[],
  placement: AdPlacement,
  ctx: { categoryIds?: number[]; query?: string } = {},
): AdRow[] {
  const cats = ctx.categoryIds ?? [];
  return ads.filter((a) => {
    if (!(a.placements ?? ["home"]).includes(placement)) return false;
    const targets = a.category_ids ?? [];
    if (placement === "home") return true;
    if (placement === "category") return targets.length === 0 || targets.some((id) => cats.includes(id));
    return targets.some((id) => cats.includes(id)) || keywordsMatch(a.keywords, ctx.query ?? "");
  });
}

/** Sorteia um anúncio (rodízio simples). */
export function pickAd<T>(list: T[], rnd: () => number = Math.random): T | null {
  return list.length ? list[Math.floor(rnd() * list.length)] : null;
}
