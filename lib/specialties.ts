import type { ProviderRow } from "./types";

export type Specialty = { id: number; category_id: number; slug: string; name: string };
export const MAX_SPECIALTIES = 5;

/** Etiquetas do perfil: as especialidades escolhidas e, por último, a que a pessoa escreveu. */
export function providerSpecialtyLabels(p: Pick<ProviderRow, "specialty_names" | "custom_specialty">): string[] {
  const names = [...(p.specialty_names ?? [])];
  if (p.custom_specialty) names.push(p.custom_specialty);
  return names;
}

/** Especialidades de uma categoria que têm pelo menos um prestador na lista, com a contagem (para os filtros). */
export function specialtyCounts(
  providers: Pick<ProviderRow, "specialty_slugs">[],
  ofCategory: Pick<Specialty, "slug" | "name">[],
): { slug: string; name: string; count: number }[] {
  return ofCategory
    .map((s) => ({ slug: s.slug, name: s.name, count: providers.filter((p) => p.specialty_slugs?.includes(s.slug)).length }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

export function filterBySpecialty<T extends Pick<ProviderRow, "specialty_slugs">>(list: T[], slug: string | undefined): T[] {
  return slug ? list.filter((p) => p.specialty_slugs?.includes(slug)) : list;
}

/** Só aceita um filtro que exista na categoria (ignora lixo na URL). */
export function parseSpecialtyFilter(raw: string | undefined, valid: { slug: string }[]): string | undefined {
  return raw && valid.some((s) => s.slug === raw) ? raw : undefined;
}
