import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/condo";
import type { Category, ProviderRow } from "@/lib/types";
import { filterKind, parseKind, parseOrder, sortProviders } from "@/lib/listing";
import { ProviderCard } from "@/components/ProviderCard";
import { ListControls } from "@/components/ListControls";

export default async function Categoria({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; cat: string }>;
  searchParams: Promise<{ ordem?: string; tipo?: string }>;
}) {
  const { slug, cat } = await params;
  const sp = await searchParams;
  const order = parseOrder(sp.ordem, false);
  const kind = parseKind(sp.tipo);
  const { condo, supabase } = await requireMember(slug);
  const { data: category } = await supabase.from("categories").select("*").eq("slug", cat).maybeSingle();
  if (!category) notFound();
  const { data } = await supabase
    .from("provider_listing")
    .select("*")
    .eq("condo_id", condo.id)
    .eq("category_slug", cat)
    .eq("status", "active")
    .limit(300);
  const all = (data ?? []) as ProviderRow[];
  const providers = sortProviders(filterKind(all, kind), order);
  const c = category as Category;
  return (
    <div className="space-y-3">
      <Link href={`/c/${slug}`} className="text-sm text-navy/60">← Categorias</Link>
      <h1 className="text-xl font-bold">{c.icon} {c.name}</h1>
      {all.length > 1 && (
        <ListControls base={`/c/${slug}/categoria/${cat}`} order={order} kind={kind} orders={["melhores", "avaliados", "recentes"]} />
      )}
      {providers.map((p) => <ProviderCard key={p.id} slug={slug} p={p} />)}
      {providers.length === 0 && all.length > 0 && (
        <p className="card text-center text-navy/70">Ninguém neste filtro. Tente ver “Todos”.</p>
      )}
      {all.length === 0 && (
        <div className="card text-center text-navy/70">
          Ainda não há indicações aqui.{" "}
          <Link href={`/c/${slug}/novo`} className="font-semibold text-brand-700 underline">Seja o primeiro a indicar</Link>.
        </div>
      )}
    </div>
  );
}
