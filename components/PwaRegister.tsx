"use client";
import { useEffect } from "react";

/** Registra o service worker (só em produção). Ele apenas mostra uma tela "sem conexão"; não guarda dados. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
