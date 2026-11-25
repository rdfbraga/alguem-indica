"use client";
import { useState } from "react";

/** Copia um texto (a chave Pix) para a área de transferência. */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2500);
        } catch {
          /* sem permissão: a pessoa ainda pode selecionar o texto */
        }
      }}
      className="btn-secondary !px-3 !py-1.5 !text-xs"
      aria-live="polite"
    >
      {done ? "Copiado ✓" : label}
    </button>
  );
}
