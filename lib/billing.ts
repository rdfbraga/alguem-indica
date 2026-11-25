/** Valores em centavos. */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "29", "29,90", "R$ 29,90", "1.290,50" → centavos; inválido → null. */
export function parseBRL(input: string): number | null {
  const s = input.replace(/[^\d,.-]/g, "").trim();
  if (!s) return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** Mesmo cálculo do banco: 1 mês = preço; 3 meses = preço × 3 com o desconto do trimestre. */
export function planAmount(priceCents: number, months: 1 | 3, discountPct: number): number {
  return months === 3 ? Math.round((priceCents * 3 * (100 - discountPct)) / 100) : priceCents;
}

export function planMonthsLabel(months: number): string {
  return months === 1 ? "1 mês" : `${months} meses`;
}

/** Mensagem que o prestador manda à administração depois de pagar. */
export function buildPaymentMessage(args: { providerName: string; amountCents: number; months: number; condoName: string }): string {
  return (
    `Olá! Paguei o plano Destaque do *Alguém indica?*.\n\n` +
    `Perfil: ${args.providerName}\nCondomínio: ${args.condoName}\nPeríodo: ${planMonthsLabel(args.months)}\nValor: ${formatBRL(args.amountCents)}\n\n` +
    `Pode confirmar, por favor? Obrigado!`
  );
}
