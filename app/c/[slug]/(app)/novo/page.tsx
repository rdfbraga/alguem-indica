import Link from "next/link";
import { getScope, requireMember } from "@/lib/condo";
import type { Category, CategoryGroup } from "@/lib/types";
import { groupCategories } from "@/lib/groups";
import type { Specialty } from "@/lib/specialties";
import { ProviderForm } from "./ProviderForm";
import { parseCondoKind } from "@/lib/condo-kind";
import { ExistingProvider } from "./ExistingProvider";
import type { ProviderRow } from "@/lib/types";

export default async function Novo({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ eu?: string; servico?: string; cat?: string; buscar?: string; erro?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { condo, user, member, supabase } = await requireMember(slug);
  const [{ data }, { data: groupData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
  ]);
  const { data: specData } = await supabase.from("specialties").select("id,category_id,slug,name").order("sort");
  const specialties = (specData ?? []) as Specialty[];
  const sections = groupCategories((groupData ?? []) as CategoryGroup[], (data ?? []) as Category[]);
  // Vindo de "Eu conheço alguém": já escolhe a categoria (ou "Outros" com o serviço escrito).
  const cats = (data ?? []) as Category[];
  const wanted = (sp.servico ?? "").trim().slice(0, 60);
  const fromCat = cats.find((c) => c.slug === sp.cat);
  const other = cats.find((c) => c.slug === "outros");
  const initialCategoryIds = fromCat ? [fromCat.id] : wanted && other ? [other.id] : [];
  const initialCustom = !fromCat && wanted ? wanted : "";
  // "Esse profissional já está no app?": só no caminho de um pedido ("Eu conheço alguém")
  const buscar = (sp.buscar ?? "").trim().slice(0, 60);
  let found: ProviderRow[] = [];
  if (wanted && buscar.length >= 2) {
    // Busca sem acento e com tolerância a erro de digitação (função do banco; só traz perfis que a pessoa já pode ver)
    const { data: ids } = await supabase.rpc("find_provider_ids", { p_condos: await getScope(condo.id), p_q: buscar, p_limit: 12 });
    const order = ((ids ?? []) as { id: string }[]).map((r) => r.id);
    if (order.length) {
      const { data: hits } = await supabase.from("provider_listing").select("*").in("id", order).eq("status", "active");
      const byId = new Map(((hits ?? []) as ProviderRow[]).map((p) => [p.id, p]));
      found = order.map((id) => byId.get(id)).filter((p): p is ProviderRow => Boolean(p)).slice(0, 8);
    }
  }
  return (
    <div className="space-y-4">
      <Link href={`/c/${slug}`} className="text-sm text-navy/60">← Voltar</Link>
      <h1 className="text-xl font-bold">Cadastrar um prestador</h1>
      {wanted && (
        <ExistingProvider slug={slug} servico={wanted} cat={sp.cat} buscar={buscar} results={found} viewerCondoId={condo.id} erro={sp.erro} />
      )}
      <ProviderForm slug={slug} sections={sections} userId={user.id} defaultBlock={member.block} defaultName={member.full_name} initialMode={sp.eu ? "self" : "other"} specialties={specialties} initialCategoryIds={initialCategoryIds} initialCustom={initialCustom} condoKind={parseCondoKind(condo.kind)} />
    </div>
  );
}
