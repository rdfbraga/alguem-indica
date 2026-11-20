/** Manifesto do app instalável (um por condomínio: o ícone abre direto no condomínio do morador). */
export function buildManifest(slug: string, condoName: string) {
  const start = `/c/${slug}`;
  const icon = (src: string, sizes: string, purpose: "any" | "maskable") => ({ src, sizes, type: "image/png", purpose });
  return {
    id: start,
    name: `Alguém indica? · ${condoName}`,
    short_name: "Alguém indica",
    description: "A rede de confiança do seu condomínio: prestadores indicados e avaliados pelos vizinhos.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: start,
    // scope "/" mantém login (Google e link do e-mail) e termos dentro do app, sem abrir o navegador por cima
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffaf5",
    theme_color: "#f55a00",
    categories: ["lifestyle", "social"],
    icons: [
      icon("/icons/icon-192.png", "192x192", "any"),
      icon("/icons/icon-512.png", "512x512", "any"),
      icon("/icons/icon-maskable-512.png", "512x512", "maskable"),
    ],
    shortcuts: [
      { name: "Indicar um profissional", short_name: "Indicar", url: `${start}/novo`, icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Ajuda e contato", short_name: "Ajuda", url: `${start}/ajuda`, icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}

/** Detecta se o app já está rodando instalado (tela cheia). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type InstallKind = "ios" | "other";
/** iPhone/iPad no Safari (único cenário em que a instalação é manual, pelo menu Compartilhar). */
export function installKind(ua: string, platform: string, touchPoints: number): InstallKind {
  const iOS = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);
  return iOS && /Safari\//.test(ua) ? "ios" : "other";
}
