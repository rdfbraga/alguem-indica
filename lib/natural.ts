/** Ordem "natural" para nomes com número: "Alphaville 2" vem antes de "Alphaville 10"; ignora acento e maiúscula. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}
