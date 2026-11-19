export type GroupLike = { id: number; name: string; icon: string };
export type Section<G, C> = { group: G; categories: C[] };

const OTHER_GROUP: GroupLike = { id: 0, name: "Outras", icon: "📁" };

/** Distribui as categorias nos grupos (na ordem recebida). Categorias sem grupo vão para "Outras"; grupos vazios somem. */
export function groupCategories<G extends GroupLike, C extends { group_id: number | null }>(
  groups: G[],
  categories: C[],
): Section<G | GroupLike, C>[] {
  const byGroup = new Map<number, C[]>();
  const known = new Set(groups.map((g) => g.id));
  for (const c of categories) {
    const gid = c.group_id !== null && known.has(c.group_id) ? c.group_id : 0;
    byGroup.set(gid, [...(byGroup.get(gid) ?? []), c]);
  }
  const sections: Section<G | GroupLike, C>[] = groups
    .map((g) => ({ group: g as G | GroupLike, categories: byGroup.get(g.id) ?? [] }))
    .filter((s) => s.categories.length > 0);
  const orphans = byGroup.get(0);
  if (orphans?.length) sections.push({ group: OTHER_GROUP, categories: orphans });
  return sections;
}
