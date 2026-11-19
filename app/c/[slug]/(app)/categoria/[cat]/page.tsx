import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/condo";
import type { Category, ProviderRow } from "@/lib/types";
import { ProviderCard } from "@/components/ProviderCard";

export default async function Categoria({ params }: { params: Promise<{ slug: string; cat: string }> }) {
  const { slug, cat } = await params;
  const { condo, supabase } = await requireMember(slug);
  const { data: category } = await supabase.from("categories").select("*").eq("slug", cat).maybeSingle();
  if (!category) notFound();
  const { data } = await supabase
    .from("provider_listing")
    .select("*")
    .eq("condo_id", condo.id)
    .eq("category_slug", cat)
    .eq("status", "active")
    .order("avg_rating", { ascending: false })
    .order("review_count", { ascending: false });
  const providers = (data ?? []) as ProviderRow[];
  const c = category as Category;
  return (
    <div className="space-y-3">
      <Link href={`/c/${slug}`} className="text-sm text-navy/60">← Categorias</Link>
      <h1 className="text-xl font-bold">{c.icon} {c.name}</h1>
      {providers.map((p) => <ProviderCard key={p.id} slug={slug} p={p} />)}
      {providers.length === 0 && (
        <div className="card text-center text-navy/70">
          Ainda não há indicações aqui.{" "}
          <Link href={`/c/${slug}/novo`} className="font-semibold text-brand-700 underline">Seja o primeiro a indicar</Link>.
        </div>
      )}
    </div>
  );
}
