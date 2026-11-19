import Link from "next/link";
import { requireMember } from "@/lib/condo";
import type { Category, ProviderRow } from "@/lib/types";
import { ProviderCard } from "@/components/ProviderCard";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q = "" } = await searchParams;
  const { condo, member, supabase } = await requireMember(slug);
  const firstName = member.full_name.split(" ")[0];
  const term = q.trim().replace(/[%,()]/g, " ").slice(0, 60);

  let results: ProviderRow[] = [];
  let categories: Category[] = [];
  if (term) {
    const { data } = await supabase
      .from("provider_listing")
      .select("*")
      .eq("condo_id", condo.id)
      .eq("status", "active")
      .or(`name.ilike.%${term}%,description.ilike.%${term}%,category_name.ilike.%${term}%`)
      .order("avg_rating", { ascending: false })
      .order("review_count", { ascending: false })
      .limit(50);
    results = (data ?? []) as ProviderRow[];
  } else {
    const { data } = await supabase.from("categories").select("*").order("sort");
    categories = (data ?? []) as Category[];
  }

  return (
    <div className="space-y-5">
      {!term && (
        <section className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 p-5 text-white shadow-md">
          <h1 className="text-2xl font-extrabold">Olá, {firstName}! 👋</h1>
          <p className="mt-1 text-white/90">Precisando de alguém de confiança? Veja quem os seus vizinhos indicam.</p>
        </section>
      )}
      <form action={`/c/${slug}`} className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar: encanador, diarista, personal…" className="input" autoComplete="off" />
        <button className="btn !px-4" aria-label="Buscar">🔍</button>
      </form>

      {term ? (
        <section className="space-y-3">
          <h2 className="font-extrabold">{results.length} resultado(s) para “{term}”</h2>
          {results.map((p) => <ProviderCard key={p.id} slug={slug} p={p} />)}
          {results.length === 0 && (
            <div className="card text-center text-navy/70">
              Ninguém indicado ainda. Conhece alguém?{" "}
              <Link href={`/c/${slug}/novo`} className="font-semibold text-brand-700 underline">Indique agora</Link>.
            </div>
          )}
          <Link href={`/c/${slug}`} className="block text-center text-sm text-navy/60 underline">Ver categorias</Link>
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-extrabold">O que você procura?</h2>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((c) => (
              <Link key={c.id} href={`/c/${slug}/categoria/${c.slug}`} className="card flex flex-col items-center gap-2 !p-3 text-center transition hover:-translate-y-0.5 hover:border-brand-500">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">{c.icon}</span>
                <span className="text-xs font-bold leading-tight">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
