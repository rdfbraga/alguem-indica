import { redirect } from "next/navigation";
import { getCondo, getUser } from "@/lib/condo";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";
import { condoNext } from "@/lib/next-path";

export default async function Entrar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { slug } = await params;
  const { erro, next: rawNext } = await searchParams;
  const next = condoNext(slug, rawNext);
  const condo = await getCondo(slug);
  if (await getUser()) redirect(next);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <header className="space-y-3 text-center">
        <Logo size="lg" />
        <p className="rounded-full bg-sky-soft px-4 py-1.5 text-sm font-semibold text-sky-brand">
          🏠 {condo.name}
        </p>
      </header>
      {erro && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">O link expirou ou já foi usado. Peça um novo.</p>}
      <LoginForm slug={slug} next={next} />
      <p className="text-center text-xs text-navy/50">
        Ao continuar você concorda com os <a href="/termos" className="underline">Termos</a> e a{" "}
        <a href="/privacidade" className="underline">Política de Privacidade</a>.
      </p>
    </main>
  );
}
