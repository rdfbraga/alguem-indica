export type FeedbackKind = "suporte" | "problema" | "sugestao" | "outro";
export type FeedbackStatus = "new" | "answered" | "archived";

export const FEEDBACK_KINDS: { value: FeedbackKind; icon: string; label: string; hint: string }[] = [
  { value: "suporte", icon: "🛟", label: "Preciso de ajuda", hint: "Dúvida sobre como usar o app" },
  { value: "problema", icon: "🐞", label: "Reportar problema", hint: "Algo não funcionou ou está errado" },
  { value: "sugestao", icon: "💡", label: "Sugestão", hint: "Uma ideia para melhorar" },
  { value: "outro", icon: "💬", label: "Outro assunto", hint: "Qualquer outra coisa" },
];

export const KIND_BY_VALUE = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.value, k])) as Record<FeedbackKind, (typeof FEEDBACK_KINDS)[number]>;

export function parseFeedbackKind(v: string | null | undefined): FeedbackKind | null {
  return FEEDBACK_KINDS.some((k) => k.value === v) ? (v as FeedbackKind) : null;
}

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 1000;

/** Valida e normaliza o texto: remove espaços nas pontas; devolve erro em português se inválido. */
export function validateMessage(raw: string, max = MESSAGE_MAX): { ok: true; text: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (text.length < MESSAGE_MIN) return { ok: false, error: `Escreva um pouco mais (mínimo ${MESSAGE_MIN} caracteres).` };
  if (text.length > max) return { ok: false, error: `A mensagem deve ter até ${max} caracteres.` };
  return { ok: true, text };
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "Aguardando resposta",
  answered: "Respondida",
  archived: "Arquivada",
};
