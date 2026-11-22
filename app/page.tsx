import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/condo";
import { LAST_CONDO_COOKIE, pickCondo } from "@/lib/last-condo";

export default async function Home() {
  // Quem já usa o app volta para o condomínio em que estava (ou escolhe, se tem vários).
  let mine: { slug: string; name: string }[] = [];
  if (await getUser()) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("my_condos");
    mine = (data ?? []) as { slug: string; name: string }[];
    const target = pickCondo(mine.map((c) => c.slug), (await cookies()).get(LAST_CONDO_COOKIE)?.value);
    if (target) redirect(`/c/${target}`);
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo size="lg" />
      {mine.length > 1 ? (
        <>
          <p className="muted">Em qual condomínio você quer entrar?</p>
          <ul className="w-full space-y-2">
            {mine.map((c) => (
              <li key={c.slug}>
                <Link href={`/c/${c.slug}`} className="card flex items-center gap-3 text-left font-extrabold transition hover:border-brand-500">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xl">🏠</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-navy/40" aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">
          Prestadores indicados e avaliados pelos seus vizinhos. Para entrar, use o link do seu condomínio
          (ele costuma estar no grupo de WhatsApp ou na portaria).
        </p>
      )}
      <p className="text-sm text-navy/50">
        <a href="/termos" className="underline">Termos</a> · <a href="/privacidade" className="underline">Privacidade</a>
      </p>
    </main>
  );
}
