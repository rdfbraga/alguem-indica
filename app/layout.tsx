import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.alguemindica.app.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Alguém indica? — a rede de confiança do seu condomínio",
  description: "Encontre prestadores indicados e avaliados pelos seus vizinhos.",
  applicationName: "Alguém indica?",
  appleWebApp: { capable: true, title: "Alguém indica", statusBarStyle: "default" },
  openGraph: {
    title: "Alguém indica?",
    description: "A rede de confiança do seu condomínio: prestadores indicados e avaliados pelos seus vizinhos.",
    siteName: "Alguém indica?",
    locale: "pt_BR",
    type: "website",
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f55a00" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
