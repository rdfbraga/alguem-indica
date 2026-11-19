import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/condo";
import { condoPathFrom, parseOtpType, parseTokenHash } from "@/lib/auth-link";

// Conclui o acesso por link de e-mail. É POST (clique no botão da tela /auth/confirm),
// para que verificadores de link de e-mail que só "abrem" a URL não gastem o link.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token_hash = parseTokenHash(String(form.get("token_hash") ?? ""));
  const type = parseOtpType(String(form.get("type") ?? ""));
  const next = safeNext(String(form.get("next") ?? ""), "/");
  const origin = new URL(request.url).origin;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`, 303);
  }
  const condo = condoPathFrom(next);
  return NextResponse.redirect(`${origin}${condo ? `${condo}/entrar?erro=1` : "/"}`, 303);
}
