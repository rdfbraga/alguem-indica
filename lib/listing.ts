import type { ProviderRow } from "./types";

export type Order = "relevancia" | "melhores" | "avaliados" | "recentes";
export type Kind = "todos" | "morador" | "externo";

export const ORDER_LABELS: Record<Order, string> = {
  relevancia: "Mais relevantes",
  melhores: "Melhor avaliados",
  avaliados: "Mais avaliados",
  recentes: "Mais recentes",
};
export const KIND_LABELS: Record<Kind, string> = {
  todos: "Todos",
  morador: "Moradores",
  externo: "Externos",
};

export function parseOrder(v: string | undefined, allowRelevance: boolean): Order {
  const def: Order = allowRelevance ? "relevancia" : "melhores";
  if (v === "melhores" || v === "avaliados" || v === "recentes") return v;
  if (v === "relevancia" && allowRelevance) return v;
  return def;
}
export function parseKind(v: string | undefined): Kind {
  return v === "morador" || v === "externo" ? v : "todos";
}

const PRIOR_MEAN = 4.0; // nota "esperada" de quem tem poucas avaliações
const PRIOR_WEIGHT = 3; // equivale a 3 avaliações imaginárias

/** Média ponderada: 1 avaliação nota 5 não passa por cima de 20 avaliações com 4,8. Sem avaliações = -1 (vai pro fim). */
export function bayesScore(p: Pick<ProviderRow, "avg_rating" | "review_count">): number {
  if (!p.review_count) return -1;
  const v = p.review_count;
  return (v / (v + PRIOR_WEIGHT)) * Number(p.avg_rating) + (PRIOR_WEIGHT / (v + PRIOR_WEIGHT)) * PRIOR_MEAN;
}

export function filterKind<T extends Pick<ProviderRow, "kind">>(list: T[], kind: Kind): T[] {
  return kind === "todos" ? list : list.filter((p) => p.kind === (kind === "morador" ? "resident" : "external"));
}

/** `scores` (relevância da busca) só é usado quando order === "relevancia". */
export function sortProviders(list: ProviderRow[], order: Order, scores?: Map<string, number>): ProviderRow[] {
  const byDate = (a: ProviderRow, b: ProviderRow) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
  const out = [...list];
  out.sort((a, b) => {
    switch (order) {
      case "relevancia":
        return (scores?.get(b.id) ?? 0) - (scores?.get(a.id) ?? 0) || bayesScore(b) - bayesScore(a) || byDate(a, b);
      case "avaliados":
        return b.review_count - a.review_count || bayesScore(b) - bayesScore(a) || byDate(a, b);
      case "recentes":
        return byDate(a, b);
      default:
        return bayesScore(b) - bayesScore(a) || b.review_count - a.review_count || byDate(a, b);
    }
  });
  return out;
}
