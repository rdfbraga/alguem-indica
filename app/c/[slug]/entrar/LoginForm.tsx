"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/c/${slug}`)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setStatus("error");
      setMessage("Não foi possível enviar o link. Confira o e-mail e tente de novo.");
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
      <div className="card text-center">
        <div className="text-4xl">📬</div>
        <p className="mt-2 font-semibold">Confira seu e-mail</p>
        <p className="mt-1 text-sm text-stone-600">
          Enviamos um link para <b>{email}</b>. Abra-o <b>neste mesmo aparelho</b> para entrar.
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      <button onClick={google} className="btn-secondary w-full">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/>
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/>
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
        </svg>
        Entrar com Google
      </button>
      <div className="flex items-center gap-3 text-xs text-stone-400">
        <div className="h-px flex-1 bg-stone-200" /> ou <div className="h-px flex-1 bg-stone-200" />
      </div>
      <form onSubmit={sendLink} className="space-y-3">
        <div>
          <label htmlFor="email" className="label">Seu e-mail</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="voce@email.com" />
        </div>
        <button disabled={status === "sending"} className="btn w-full">
          {status === "sending" ? "Enviando…" : "Receber link de acesso"}
        </button>
      </form>
      {status === "error" && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
