"use client";
import { useState } from "react";

/** Convite entre vizinhos: abre o compartilhamento do celular (ou o WhatsApp) com a mensagem pronta. Não lê contatos. */
export function InviteButton({ text, url, label = "📲 Convidar vizinhos" }: { text: string; url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // a pessoa fechou a janela: tudo bem
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* sem permissão para copiar: o botão principal continua funcionando */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={share} className="btn !bg-[#25D366] !px-4 !py-2 !text-sm hover:!bg-[#1ebe57]">{label}</button>
      <button type="button" onClick={copy} className="text-sm font-semibold text-navy/60 underline" aria-live="polite">
        {copied ? "Link copiado ✓" : "Copiar o link"}
      </button>
    </div>
  );
}
