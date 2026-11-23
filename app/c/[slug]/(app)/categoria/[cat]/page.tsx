import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeatures, getRegionInfo, getScope, requireMember } from "@/lib/condo";
import type { Category, ProviderRow } from "@/lib/types";
import { filterKind, parseKind, parseOrder, sortProviders } from "@/lib/listing";
import { ProviderCard } from "@/components/ProviderCard";
import { parseCondoKind } from "@/lib/condo-kind";
import { ListControls } from "@/components/ListControls";
import { HelpRequestButtons } from "@/components/HelpRequestButtons";
import { RequestForm } from "@/components/RequestForm";
import { SpecialtyChips } from "@/components/SpecialtyChips";
import { filterBySpecialty, parseSpecialtyFilter, specialtyCounts, type Specialty } from "@/lib/specialties";

export default async function Categoria({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; cat: string }>;
  searchParams: Promise<{ ordem?: string; tipo?: string; esp?: string }>;
}) {
  const { slug, cat } = await params;
  const sp = await searchParams;
  const order = parseOrder(sp.ordem, false);
  const kind = parseKind(sp.tipo);
  const { condo, member, supabase } = await requireMember(slug);
  const flags = await getFeatures(condo.id);
  const scope = await getScope(condo.id);
  const { data: category } = await supabase.from("categories").select("*").eq("slug", cat).maybeSingle();
  if (!category) notFound();
  // Um perfil aparece em todas as suas categorias. (Se a migration 0007 ainda não rodou, usa só a principal.)
  let res = await supabase
    .from("provider_listing")
    .select("*")
    .in("condo_id", scope)
    .contains("category_slugs", [cat])
    .eq("status", "active")
    .limit(300);
  if (res.error) {
    res = await supabase.from("provider_listing").select("*").in("condo_id", scope).eq("category_slug", cat).eq("status", "active").limit(300);
  }
  const data = res.data;
  const all = (data ?? []) as ProviderRow[];
  const c = category as Category;
  // Filtro por especialidade (só as que têm prestadores neste condomínio).
  const { data: specData } = await supabase.from("specialties").select("id,category_id,slug,name").eq("category_id", c.id);
  // Categoria sem nenhum prestador na região: conta como "procura sem oferta" (aparece em "Os vizinhos estão procurando").
  if (all.length === 0) await supabase.rpc("log_search_miss", { p_condo: condo.id, p_q: c.name.split(" / ")[0] });
  const specOptions = specialtyCounts(all, (specData ?? []) as Specialty[]);
  const esp = parseSpecialtyFilter(sp.esp, specOptions);
  const providers = sortProviders(filterBySpecialty(filterKind(all, kind), esp), order, undefined, condo.id);
  const keep = { ordem: sp.ordem && order !== "melhores" ? order : undefined, tipo: kind !== "todos" ? kind : undefined };
  return (
    <div className="space-y-3">
      <Link href={`/c/${slug}`} className="text-sm text-navy/60">← Categorias</Link>
      <h1 className="text-xl font-bold">{c.icon} {c.name}</h1>
      {specOptions.length > 0 && (
        <SpecialtyChips base={`/c/${slug}/categoria/${cat}`} options={specOptions} current={esp} total={all.length} keep={keep} />
      )}
      {all.length > 1 && (
        <ListControls base={`/c/${slug}/categoria/${cat}`} order={order} kind={kind} orders={["melhores", "avaliados", "recentes"]} extra={{ esp }} />
      )}
      {providers.map((p) => <ProviderCard key={p.id} slug={slug} p={p} planBadge={flags.plans} viewerCondoId={condo.id} kind={parseCondoKind(condo.kind)} />)}
      {providers.length === 0 && all.length > 0 && (
        <p className="card text-center text-navy/70">Ninguém neste filtro. Tente ver “Todos”.</p>
      )}
      {all.length === 0 && (
        <div className="card space-y-4 text-center text-navy/70">
          <p>
            Ainda não há indicações aqui.{" "}
            <Link href={`/c/${slug}/novo?servico=${encodeURIComponent(c.name.split(" / ")[0])}&cat=${encodeURIComponent(c.slug)}`} className="font-semibold text-brand-700 underline">Seja o primeiro a indicar</Link>.
          </p>
          <div className="mx-auto max-w-xs space-y-3 text-left">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-navy/65">Pergunte aos vizinhos nos grupos de WhatsApp</div>
              <HelpRequestButtons slug={slug} residentName={member.full_name} condoName={condo.name} what={c.name.split(" / ")[0]} region={await getRegionInfo(condo.id)} />
            </div>
            <RequestForm slug={slug} label={c.name.split(" / ")[0]} cta="🔔 Quero ser avisado por e-mail" />
          </div>
        </div>
      )}
    </div>
  );
}
