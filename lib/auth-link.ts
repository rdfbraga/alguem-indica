import type { EmailOtpType } from "@supabase/supabase-js";

const ALLOWED: EmailOtpType[] = ["email", "magiclink", "signup"];

/** Só aceita os tipos de link que o app usa (acesso por e-mail e confirmação de cadastro). */
export function parseOtpType(v: string | null | undefined): EmailOtpType | null {
  return ALLOWED.includes(v as EmailOtpType) ? (v as EmailOtpType) : null;
}

/** Token do link: só caracteres seguros e tamanho razoável. */
export function parseTokenHash(v: string | null | undefined): string | null {
  return v && /^[A-Za-z0-9_.-]{8,200}$/.test(v) ? v : null;
}

/** Caminho do condomínio (/c/<slug>) a partir do destino, para voltar à tela de entrada em caso de erro. */
export function condoPathFrom(next: string): string | null {
  const m = /^\/c\/([a-z0-9-]+)/.exec(next);
  return m ? `/c/${m[1]}` : null;
}
