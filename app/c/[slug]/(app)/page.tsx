import Link from "next/link";
import { requireMember } from "@/lib/condo";
import type { Category, ProviderRow } from "@/lib/types";
import { filterKind, parseKind, parseOrder, sortProviders } from "@/lib/listing";
import { ProviderCard } from "@/components/ProviderCard";
import { ListControls } from "@/components/ListControls";
import { SearchBox } from "@/components/SearchBox";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; ordem?: string; tipo?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const { condo, member, supabase } = await requireMember(slug);
  const firstName = member.full_name.split(" ")[0];

  const { data: catData } = await supabase.from("categories").select("id,slug,name,icon").order("sort");
  const categories = (catData ?? []) as Category[];
  const suggestions = categories.filter((c) => c.slug !== "outros").map((c) => c.name.split(" / ")[0]);

  if (q) {
    const order = parseOrder(sp.ordem, true);
    const kind = parseKind(sp.tipo);
    const { data: hits } = await supabase.rpc("search_provider_ids", { p_condo: condo.id, p_q: q });
    const scores = new Map<string, number>(((hits ?? []) as { id: string; score: number }[]).map((h) => [h.id, h.score]));
    let results: ProviderRow[] = [];
    if (scores.size) {
      const { data } = await supabase.from("provider_listing").select("*").in("id", [...scores.keys()]);
      results = sortProviders(filterKind((data ?? []) as ProviderRow[], kind), order, scores);
    }
    return (
      <div className="space-y-4">
        <SearchBox slug={slug} q={q} suggestions={suggestions} />
        <h2 className="font-extrabold">{results.length} resultado(s) para “{q}”</h2>
        <ListControls base={`/c/${slug}`} q={q} order={order} kind={kind} orders={["relevancia", "melhores", "avaliados", "recentes"]} />
        {results.map((p) => <ProviderCard key={p.id} slug={slug} p={p} />)}
        {results.length === 0 && (
          <div className="card space-y-3 text-center text-navy/70">
            <p>Ninguém indicado para essa busca ainda. Conhece alguém?{" "}
              <Link href={`/c/${slug}/novo`} className="font-bold text-brand-700 underline">Indique agora</Link>.</p>
            <p className="text-sm">Ou escolha uma categoria:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {categories.slice(0, 8).map((c) => (
                <Link key={c.id} href={`/c/${slug}/categoria/${c.slug}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold">
                  {c.icon} {c.name.split(" / ")[0]}
                </Link>
              ))}
            </div>
          </div>
        )}
        <Link href={`/c/${slug}`} className="block text-center text-sm text-navy/60 underline">Ver categorias</Link>
      </div>
    );
  }

  // Destaques: a partir de um único conjunto de prestadores ativos.
  const { data: all } = await supabase
    .from("provider_listing")
    .select("*")
    .eq("condo_id", condo.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);
  const providers = (all ?? []) as ProviderRow[];
  const topRated = sortProviders(providers.filter((p) => p.review_count > 0), "melhores").slice(0, 5);
  const topIds = new Set(topRated.map((p) => p.id));
  const newest = providers.filter((p) => !topIds.has(p.id)).slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 p-5 text-white shadow-md">
        <h1 className="text-2xl font-extrabold">Olá, {firstName}! 👋</h1>
        <p className="mt-1 text-white/90">Precisando de alguém de confiança? Veja quem os seus vizinhos indicam.</p>
      </section>
      <SearchBox slug={slug} q="" suggestions={suggestions} />

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

      {topRated.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">⭐ Mais bem avaliados do condomínio</h2>
          {topRated.map((p) => <ProviderCard key={p.id} slug={slug} p={p} />)}
        </section>
      )}
      {newest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">🆕 Indicações recentes</h2>
          {newest.map((p) => <ProviderCard key={p.id} slug={slug} p={p} />)}
        </section>
      )}
      {providers.length === 0 && (
        <p className="card text-center text-navy/70">
          Ainda não há indicações no condomínio. Seja o primeiro a{" "}
          <Link href={`/c/${slug}/novo`} className="font-bold text-brand-700 underline">indicar um profissional</Link>!
        </p>
      )}
    </div>
  );
}
