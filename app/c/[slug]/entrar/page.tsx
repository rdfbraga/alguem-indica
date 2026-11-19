import { redirect } from "next/navigation";
import { getCondo, getUser } from "@/lib/condo";
import { LoginForm } from "./LoginForm";

export default async function Entrar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const condo = await getCondo(slug);
  if (await getUser()) redirect(`/c/${slug}`);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <div className="text-4xl">🏢</div>
        <h1 className="mt-2 text-2xl font-bold text-brand-700">Alguém Indica</h1>
        <p className="text-stone-600">Indicações de confiança de <b>{condo.name}</b></p>
      </header>
      {erro && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">O link expirou ou foi aberto em outro aparelho. Peça um novo.</p>}
      <LoginForm slug={slug} />
      <p className="text-center text-xs text-stone-400">
        Ao continuar você concorda com os <a href="/termos" className="underline">Termos</a> e a{" "}
        <a href="/privacidade" className="underline">Política de Privacidade</a>.
      </p>
    </main>
  );
}
