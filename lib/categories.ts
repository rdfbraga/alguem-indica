export const MAX_CATEGORIES = 3;

/** Lê os ids de categoria do formulário: só inteiros positivos, sem repetir, na ordem enviada (a primeira é a principal). */
export function parseCategoryIds(values: FormDataEntryValue[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

type Labelable = {
  category_slug: string;
  category_name: string;
  custom_category?: string | null;
  category_slugs?: string[] | null;
  category_names?: string[] | null;
};

/** Nomes das categorias do perfil (principal primeiro). Em "Outros", mostra o que o morador digitou. */
export function providerCategoryLabels(p: Labelable): string[] {
  const slugs = p.category_slugs?.length ? p.category_slugs : [p.category_slug];
  const names = p.category_names?.length ? p.category_names : [p.category_name];
  return slugs.map((slug, i) => (slug === "outros" && p.custom_category ? p.custom_category : (names[i] ?? slug)));
}
