"use client";
import { useEffect, useRef, useState } from "react";
import { installKind, isStandalone } from "@/lib/pwa";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const KEY = "pwa-install-dismissed";
const QUIET_DAYS = 30;

/** Convite para instalar o app: botão direto no Android/Chrome e passo a passo no iPhone. Some depois de instalado ou dispensado. */
export function InstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "native" | "ios">("hidden");
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      const t = Number(localStorage.getItem(KEY));
      if (t && Date.now() - t < QUIET_DAYS * 86_400_000) return;
    } catch {
      /* sem localStorage: mostra mesmo assim */
    }
    if (installKind(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) === "ios") {
      setMode("ios");
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as InstallEvent;
      setMode("native");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignora */
    }
    setMode("hidden");
  }

  async function install() {
    const ev = deferred.current;
    if (!ev) return;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred.current = null;
    if (outcome === "accepted") setMode("hidden");
    else dismiss();
  }

  if (mode === "hidden") return null;
  return (
    <aside className="card flex items-start gap-3 !border-brand-500/40 !p-3" aria-label="Instalar o aplicativo">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl" aria-hidden>📲</span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-extrabold">Instale o app no seu celular</div>
        {mode === "native" ? (
          <p className="text-navy/70">Acesse em um toque, direto da tela inicial, sem abrir o navegador.</p>
        ) : (
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-navy/75">
            <li>Toque em <b>Compartilhar</b> <span aria-hidden>(⬆️)</span> na barra do Safari.</li>
            <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
          </ol>
        )}
        <div className="mt-2 flex items-center gap-3">
          {mode === "native" && <button onClick={install} className="btn !px-4 !py-1.5 !text-sm">Instalar</button>}
          <button onClick={dismiss} className="text-sm font-semibold text-navy/60 underline">{mode === "native" ? "Agora não" : "Entendi"}</button>
        </div>
      </div>
    </aside>
  );
}
