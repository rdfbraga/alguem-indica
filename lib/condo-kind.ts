export type CondoKind = "building" | "houses";

export const KIND_LABEL: Record<CondoKind, string> = { building: "🏢 Prédios", houses: "🏡 Casas" };

export function parseCondoKind(v: unknown): CondoKind {
  return v === "houses" ? "houses" : "building";
}

/** Rótulos do cadastro e das telas conforme o tipo: prédios usam bloco e unidade; casas usam rua e número. */
export function placeLabels(kind: CondoKind) {
  return kind === "houses"
    ? {
        primary: "Rua",
        primaryPlaceholder: "Rua das Acácias",
        secondary: "Número da casa",
        secondaryPlaceholder: "123",
        providerPrimary: "Rua do profissional",
        groupTitle: "Moradores cadastrados por rua",
        missing: "Informe a rua e o número da casa.",
      }
    : {
        primary: "Bloco / Torre",
        primaryPlaceholder: "B",
        secondary: "Unidade",
        secondaryPlaceholder: "204",
        providerPrimary: "Bloco / Torre do profissional",
        groupTitle: "Moradores cadastrados por bloco",
        missing: "Informe bloco/torre e unidade.",
      };
}

/** "Bloco B" (prédios) ou "Rua das Acácias" (casas). */
export function blockText(kind: CondoKind, block: string): string {
  return kind === "houses" ? block : `Bloco ${block}`;
}

/** Endereço completo, só para a administração: "Bloco B, 204" ou "Rua das Acácias, casa 123". */
export function placeText(kind: CondoKind, block: string, unit: string): string {
  return kind === "houses" ? `${block}, casa ${unit}` : `Bloco ${block}, ${unit}`;
}
