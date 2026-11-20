import Link from "next/link";

/** Chamada na home para quem presta serviço. Destaque proposital: é o que traz oferta para o condomínio. */
export function ProviderCta({ slug, pending }: { slug: string; pending?: { id: string; name: string } | null }) {
  if (pending) {
    return (
      <Link
        href={`/c/${slug}/p/${pending.id}`}
        className="flex items-center gap-3 rounded-3xl border-2 border-amber-300 bg-amber-50 p-4 transition hover:bg-amber-100"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl" aria-hidden>⏳</span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold leading-tight">Seu perfil está no ar</span>
          <span className="mt-0.5 block text-sm text-navy/75">“{pending.name}” aguarda a confirmação da administração. Toque para ver ou completar.</span>
        </span>
        <span className="text-navy/40" aria-hidden>›</span>
      </Link>
    );
  }
  return (
    <section aria-label="Cadastre seu serviço" className="rounded-3xl border-2 border-brand-500 bg-brand-50 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl" aria-hidden>🧰</span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold leading-tight">Você presta algum serviço?</h2>
          <p className="mt-0.5 text-sm text-navy/75">Cadastre seu perfil grátis e seja encontrado pelos vizinhos do condomínio.</p>
        </div>
      </div>
      <Link href={`/c/${slug}/novo?eu=1`} className="btn mt-3 w-full">Cadastrar meu serviço</Link>
    </section>
  );
}
