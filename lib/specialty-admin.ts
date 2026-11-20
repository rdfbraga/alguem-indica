/** Categorias que TODOS os perfis do grupo têm (só nelas a especialidade vale para o grupo inteiro). */
export function commonCategoryIds(lists: number[][]): number[] {
  if (lists.length === 0) return [];
  return lists.reduce((acc, l) => acc.filter((id) => l.includes(id)), lists[0]);
}

/** Categorias de qualquer perfil do grupo, da mais frequente para a menos. */
export function categoriesByFrequency(lists: number[][]): number[] {
  const count = new Map<number, number>();
  for (const l of lists) for (const id of new Set(l)) count.set(id, (count.get(id) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id]) => id);
}
