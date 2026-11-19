"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Registra uma visita ao perfil (no máximo 1 a cada 30 min por aparelho). Silencioso: nunca mostra erro. */
export function ViewTracker({ providerId }: { providerId: string }) {
  useEffect(() => {
    const key = `view:${providerId}`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* sessionStorage indisponível: registra mesmo assim (o banco evita repetição) */
    }
    createClient().rpc("log_provider_event", { p_provider: providerId, p_kind: "view" }).then(() => {}, () => {});
  }, [providerId]);
  return null;
}
