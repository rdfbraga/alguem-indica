"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Conta uma exibição do anúncio (no máximo 1 a cada 6 horas por aparelho). Silencioso. */
export function AdTracker({ adId }: { adId: string }) {
  useEffect(() => {
    const key = `ad:${adId}`;
    try {
      if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) < 6 * 3_600_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* sem sessionStorage: o banco evita a repetição */
    }
    createClient().rpc("log_ad_event", { p_ad: adId, p_kind: "view" }).then(() => {}, () => {});
  }, [adId]);
  return null;
}
