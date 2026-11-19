export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">🏢</div>
      <h1 className="text-3xl font-bold text-brand-700">Indikaí</h1>
      <p className="text-stone-600">
        Prestadores indicados e avaliados pelos seus vizinhos. Para entrar, use o link do seu condomínio
        (ele costuma estar no grupo de WhatsApp ou na portaria).
      </p>
      <p className="text-sm text-stone-400">
        <a href="/termos" className="underline">Termos</a> · <a href="/privacidade" className="underline">Privacidade</a>
      </p>
    </main>
  );
}
