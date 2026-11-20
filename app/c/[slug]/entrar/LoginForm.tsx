"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMicrosoftMail } from "@/lib/email-hint";

/** Traduz o erro do Supabase para algo útil (e mostra o código para facilitar o suporte). */
function otpErrorMessage(error: { status?: number; code?: string; message?: string }): string {
  const code = error.code ?? "";
  const ref = ` (${[error.status, code].filter(Boolean).join(" · ") || "erro"})`;
  if (error.status === 429 || code.includes("rate_limit")) {
    return "Muitos pedidos de link em pouco tempo. Aguarde alguns minutos e tente de novo." + ref;
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "Esse e-mail parece inválido. Confira e tente de novo." + ref;
  }
  if (error.status === 500 || code === "unexpected_failure" || /sending .*email/i.test(error.message ?? "")) {
    return "Não conseguimos enviar o e-mail agora. Tente de novo em instantes ou entre com o Google." + ref;
  }
  return "Não foi possível enviar o link. Confira o e-mail e tente de novo." + ref;
}

export function LoginForm({ slug, next }: { slug: string; next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  // O Google é o caminho principal; o link por e-mail fica recolhido como segunda opção.
  const [showEmail, setShowEmail] = useState(false);
  const microsoft = isMicrosoftMail(email);

  // Google: volta pelo callback (OAuth). Link de e-mail: abre uma tela própria (/auth/confirm),
  // com o link no domínio do app (melhora a entrega) e conclusão só no clique do botão.
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const emailRedirectTo = () => `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: emailRedirectTo() },
    });
    if (error) {
      console.error("signInWithOtp", error);
      setStatus("error");
      setMessage(otpErrorMessage(error));
    } else setStatus("sent");
  }

  async function google() {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setStatus("error");
      setMessage("Login com Google indisponível no momento.");
    }
  }

  if (status === "sent")
    return (
      <div className="card space-y-3 text-center">
        <div className="text-4xl">📬</div>
        <p className="font-bold">Confira seu e-mail</p>
        <p className="text-sm text-navy/70">
          Enviamos um link para <b>{email}</b>. É só tocar nele para entrar.
        </p>
        {microsoft ? (
          <p className="rounded-2xl bg-amber-50 p-3 text-left text-sm text-amber-900">
            <b>Usa Hotmail, Outlook ou Live?</b> O e-mail pode levar alguns minutos e cair na pasta de{" "}
            <b>lixo eletrônico</b>. Procure por “Alguém indica?” e marque como “não é lixo”.
          </p>
        ) : (
          <p className="text-sm text-navy/60">Não chegou? Olhe também a pasta de spam.</p>
        )}
        <button onClick={() => setStatus("idle")} className="text-sm font-semibold text-sky-brand underline">
          Voltar
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <button onClick={google} className="btn-secondary w-full !py-3.5 text-base shadow-sm">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/>
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/>
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
        </svg>
        Entrar com Google
      </button>

      {!showEmail && status !== "error" ? (
        <button onClick={() => setShowEmail(true)} className="mx-auto block text-sm font-semibold text-sky-brand underline">
          Receba o link de acesso via e-mail
        </button>
      ) : (
        <form onSubmit={sendLink} className="space-y-3 rounded-3xl border border-orange-100 bg-white p-4">
          <div>
            <label htmlFor="email" className="label">Receba o link de acesso via e-mail</label>
            <input id="email" type="email" required autoComplete="email" autoFocus={showEmail} value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="voce@email.com" />
          </div>
          {microsoft && (
            <p className="text-xs text-amber-800">
              Dica: e-mails do Hotmail/Outlook podem demorar ou cair no lixo eletrônico. Se preferir, use o Google acima.
            </p>
          )}
          <button disabled={status === "sending"} className="btn w-full">
            {status === "sending" ? "Enviando…" : "Enviar link"}
          </button>
        </form>
      )}
      {status === "error" && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
