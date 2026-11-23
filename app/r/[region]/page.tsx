import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LAST_CONDO_COOKIE, pickCondo } from "@/lib/last-condo";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/condo";
import { Logo } from "@/components/Logo";
import { naturalCompare } from "@/lib/natural";

type Row = { region_name: string; condo_id: string; condo_slug: string; condo_name: string };

async function load(region: string): Promise<Row[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("region_public", { p_slug: region });
  return ((data ?? []) as Row[]).sort((a, b) => naturalCompare(a.condo_name, b.condo_name));
}

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
  const { region } = await params;
  const rows = await load(region);
  if (!rows.length) return { title: "Alguém indica?" };
  const name = rows[0].region_name;
  return {
    title: `Alguém indica? · ${name}`,
    description: `Indicações de prestadores de confiança feitas pelos vizinhos dos condomínios da região: ${name}. Escolha o seu condomínio.`,
  };
}

/** Página pública da região: a pessoa escolhe o próprio condomínio e segue para o login. Um link só para grupos de vários condomínios. */
export default async function Regiao({ params, searchParams }: { params: Promise<{ region: string }>; searchParams: Promise<{ trocar?: string }> }) {
  const { region } = await params;
  const { trocar } = await searchParams;
  const rows = await load(region);
  if (!rows.length) notFound();

  // Quem já é moradora de um (e só um) condomínio da região vai direto para ele.
  const user = await getUser();
  let mine = new Set<string>();
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("members").select("condo_id").eq("user_id", user.id).neq("role", "provider").in("condo_id", rows.map((r) => r.condo_id));
    mine = new Set((data ?? []).map((m) => m.condo_id as string));
    // Quem já mora em um (ou volta ao último que usou) vai direto, a não ser que tenha pedido para trocar.
    if (!trocar && mine.size > 0) {
      const mySlugs = rows.filter((r) => mine.has(r.condo_id)).map((r) => r.condo_slug);
      const target = pickCondo(mySlugs, (await cookies()).get(LAST_CONDO_COOKIE)?.value);
      if (target) redirect(`/c/${target}`);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <header className="space-y-3 text-center">
        <Logo size="lg" />
        <p className="rounded-full bg-sky-soft px-4 py-1.5 text-sm font-semibold text-sky-brand">🏘️ {rows[0].region_name}</p>
      </header>
      <section className="space-y-3">
        <h1 className="text-center text-xl font-extrabold">Qual é o seu condomínio?</h1>
        <p className="text-center text-sm text-navy/70">
          Os vizinhos de cada condomínio indicam prestadores de confiança, e a região toda aproveita. Escolha o seu para entrar.
        </p>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.condo_id}>
              <Link href={`/c/${r.condo_slug}`} className="card flex items-center gap-3 transition hover:border-brand-500 active:scale-[0.99]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl">🏠</span>
                <span className="min-w-0 flex-1 truncate font-extrabold">{r.condo_name}</span>
                {mine.has(r.condo_id) && <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">você mora aqui</span>}
                <span className="text-navy/40" aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-navy/55">Não encontrou o seu condomínio? Fale com quem divulgou este link.</p>
      </section>
      <p className="text-center text-xs text-navy/50">
        Ao continuar você concorda com os <a href="/termos" className="underline">Termos</a> e a{" "}
        <a href="/privacidade" className="underline">Política de Privacidade</a>.
      </p>
    </main>
  );
}
