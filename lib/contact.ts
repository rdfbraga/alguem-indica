/** O que a pessoa costuma querer ao chamar cada tipo de profissional (a frase completa começa com "gostaria de"). */
const SCHEDULE = new Set([
  "medico", "dentista", "psicologo", "nutricionista", "fisioterapeuta", "fonoaudiologo", "cuidador",
  "manicure", "cabeleireiro", "barbeiro", "maquiador", "depilacao", "massagista",
  "veterinario", "banho-tosa", "adestrador", "passeador",
  "personal", "escolinha", "idiomas", "aulas", "baba",
  "advogado", "contador", "arquiteto", "despachante", "fotografo",
]);
const ORDER = new Set(["marmita", "doces", "salgados", "buffet", "decoracao"]);

export type Intent = "agendar" | "pedido" | "orcamento";

export function contactIntent(categorySlug: string): Intent {
  if (SCHEDULE.has(categorySlug)) return "agendar";
  if (ORDER.has(categorySlug)) return "pedido";
  return "orcamento";
}

const INTENT_TEXT: Record<Intent, string> = {
  agendar: "gostaria de saber sobre horários e valores",
  pedido: "gostaria de fazer um pedido",
  orcamento: "gostaria de pedir um orçamento",
};

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Hora (0–23) em São Paulo. */
export function hourInSaoPaulo(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(now)) % 24;
}

/** "Dra. Helena Prado – Pediatra" → "Dra. Helena Prado" (tira a especialidade depois do traço). */
export function shortProviderName(name: string): string {
  return name.split(/\s[–—-]\s/)[0].trim() || name.trim();
}

/** "Condomínio Parque Barueri" → "Parque Barueri" (a frase já diz "condomínio"). */
export function bareCondoName(name: string): string {
  return name.replace(/^condom[ií]nio\s+/i, "").trim() || name.trim();
}

/**
 * Mensagem que já vai preenchida no WhatsApp. A pessoa pode editar antes de enviar.
 * Neutra quanto a gênero e sem dados sensíveis: só o primeiro nome e o nome do condomínio.
 */
export function buildContactMessage(args: {
  providerName: string;
  residentName?: string | null;
  condoName: string;
  categorySlug: string;
  hour: number;
}): string {
  const who = args.residentName?.trim().split(/\s+/)[0];
  const intro = who ? `Meu nome é ${who} e moro no condomínio ${bareCondoName(args.condoName)}.` : `Moro no condomínio ${bareCondoName(args.condoName)}.`;
  return `${greetingFor(args.hour)}, ${shortProviderName(args.providerName)}! ${intro} Vi seu perfil no Alguém indica? e ${INTENT_TEXT[contactIntent(args.categorySlug)]}. Pode me ajudar?`;
}
