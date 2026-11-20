/** Normaliza para comparar sugestões iguais: sem acento, minúsculas, sem espaços extras. */
export function normalizeLabel(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type Suggestion<T extends { id: string }> = {
  key: string;
  label: string; // forma mais usada pelos moradores
  items: T[];
};

/** Agrupa itens cujo texto livre é igual (ignorando acento, caixa e espaços). `getLabel` devolve o texto de cada item. */
export function groupByLabel<T extends { id: string }>(items: T[], getLabel: (item: T) => string | null | undefined): Suggestion<T>[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const raw = getLabel(it);
    if (!raw) continue;
    const key = normalizeLabel(raw);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const counts = new Map<string, number>();
      list.forEach((i) => {
        const text = getLabel(i)!.trim();
        counts.set(text, (counts.get(text) ?? 0) + 1);
      });
      const label = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]; // grafia mais usada pelos moradores
      return { key, label, items: list };
    })
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, "pt-BR"));
}

/** Agrupa prestadores com a mesma categoria sugerida em "Outros". */
export function groupSuggestions<T extends { id: string; custom_category: string | null }>(items: T[]): Suggestion<T>[] {
  return groupByLabel(items, (i) => i.custom_category);
}

export function capitalizeFirst(s: string): string {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Nome da categoria a exibir: em "Outros", mostra o que o morador digitou. */
export function displayCategory(p: { category_slug: string; category_name: string; custom_category: string | null }): string {
  return p.category_slug === "outros" && p.custom_category ? p.custom_category : p.category_name;
}

// ───── Categorias parecidas (para o admin decidir se vale criar uma nova) ─────
const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "em", "para", "com", "por", "que", "uma", "uns", "umas"]);

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Duas palavras (já normalizadas) "querem dizer a mesma coisa"? Igual, mesmo radical ou quase igual. */
function wordMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (commonPrefix(a, b) >= 5) return true;
  return min >= 6 && levenshtein(a, b) <= 2;
}

const words = (s: string) => normalizeLabel(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Categorias existentes que parecem equivalentes à sugerida (pelo nome ou pelos sinônimos), da mais à menos parecida. */
export function findSimilarCategories<C extends { name: string; slug: string; keywords?: string | null }>(
  label: string,
  categories: C[],
  limit = 4,
): C[] {
  const q = normalizeLabel(label);
  const tokens = words(label).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (!q || tokens.length === 0) return [];
  return categories
    .filter((c) => c.slug !== "outros")
    .map((c) => {
      const nameWords = words(c.name);
      const kwWords = words(c.keywords ?? "");
      let score = normalizeLabel(c.name) === q ? 10 : 0;
      for (const t of tokens) {
        if (nameWords.some((w) => wordMatch(t, w))) score += 3;
        else if (kwWords.some((w) => wordMatch(t, w))) score += 1.5;
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}
