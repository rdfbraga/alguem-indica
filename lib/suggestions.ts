/** Normaliza para comparar sugestões iguais: sem acento, minúsculas, sem espaços extras. */
export function normalizeLabel(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type Suggestion<T extends { id: string; custom_category: string | null }> = {
  key: string;
  label: string; // forma mais usada pelos moradores
  items: T[];
};

/** Agrupa prestadores com a mesma categoria sugerida (ignorando acento/caixa). */
export function groupSuggestions<T extends { id: string; custom_category: string | null }>(items: T[]): Suggestion<T>[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    if (!it.custom_category) continue;
    const key = normalizeLabel(it.custom_category);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const counts = new Map<string, number>();
      list.forEach((i) => counts.set(i.custom_category!.trim(), (counts.get(i.custom_category!.trim()) ?? 0) + 1));
      const label = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { key, label, items: list };
    })
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, "pt-BR"));
}

export function capitalizeFirst(s: string): string {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Nome da categoria a exibir: em "Outros", mostra o que o morador digitou. */
export function displayCategory(p: { category_slug: string; category_name: string; custom_category: string | null }): string {
  return p.category_slug === "outros" && p.custom_category ? p.custom_category : p.category_name;
}
