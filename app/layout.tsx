import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alguém indica? — a rede de confiança do seu condomínio",
  description: "Encontre prestadores indicados e avaliados pelos seus vizinhos.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f26915" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
