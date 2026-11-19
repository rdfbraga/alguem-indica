import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo size="lg" />
      <p className="muted">
        Prestadores indicados e avaliados pelos seus vizinhos. Para entrar, use o link do seu condomínio
        (ele costuma estar no grupo de WhatsApp ou na portaria).
      </p>
      <p className="text-sm text-navy/50">
        <a href="/termos" className="underline">Termos</a> · <a href="/privacidade" className="underline">Privacidade</a>
      </p>
    </main>
  );
}
