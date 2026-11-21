import Link from "next/link";
import { getFeatures, getScope, requireMember } from "@/lib/condo";
import type { Category, CategoryGroup, ProviderRow } from "@/lib/types";
import { groupCategories } from "@/lib/groups";
import { filterKind, parseKind, parseOrder, sortProviders } from "@/lib/listing";
import { ProviderCard } from "@/components/ProviderCard";
import { ListControls } from "@/components/ListControls";
import { SearchBox } from "@/components/SearchBox";
import { AdCard } from "@/components/AdCard";
import { ReviewPrompt, type ReviewPromptItem } from "@/components/ReviewPrompt";
import { NeighborsLooking, type OpenRequest, type RequestUpdate } from "@/components/NeighborsLooking";
import { RequestForm } from "@/components/RequestForm";
import { after } from "next/server";
import { InviteButton } from "@/components/InviteButton";
import { buildInviteMessage } from "@/lib/invite";
import { SITE_URL } from "@/lib/site";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ProviderCta } from "@/components/ProviderCta";
import { adIsLive, todayInSaoPaulo } from "@/lib/features";
import type { AdRow } from "@/lib/types";

function CategoryTile({ slug, c }: { slug: string; c: Category }) {
  return (
    <Link
      href={`/c/${slug}/categoria/${c.slug}`}
      title={c.name}
      className="card flex flex-col items-center justify-center gap-0.5 !rounded-2xl !p-2 text-center transition hover:border-brand-500 active:scale-[0.97]"
    >
      <span className="text-2xl leading-none">{c.icon}</span>
      <span className="line-clamp-2 min-h-[2.1em] text-[11px] font-bold leading-tight">{c.name}</span>
    </Link>
  );
}

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
  const { condo, user, member, supabase } = await requireMember(slug);
  const firstName = member.full_name.split(" ")[0];
  const flags = await getFeatures(condo.id);
  const scope = await getScope(condo.id);   // este condomínio + os da mesma região

  const [{ data: catData }, { data: groupData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
  ]);
  const categories = (catData ?? []) as Category[];
  const sections = groupCategories((groupData ?? []) as CategoryGroup[], categories);
  const suggestions = categories.filter((c) => c.slug !== "outros").map((c) => c.name.split(" / ")[0]);

  if (q) {
    const order = parseOrder(sp.ordem, true);
    const kind = parseKind(sp.tipo);
    const { data: hits } = await supabase.rpc("search_provider_ids", { p_condo: condo.id, p_q: q });
    const scores = new Map<string, number>(((hits ?? []) as { id: string; score: number }[]).map((h) => [h.id, h.score]));
    let results: ProviderRow[] = [];
    if (scores.size) {
      const { data } = await supabase.from("provider_listing").select("*").in("id", [...scores.keys()]);
      results = sortProviders(filterKind((data ?? []) as ProviderRow[], kind), order, scores, condo.id);
    }
    // Busca sem resultado: registra para o bloco "Os vizinhos estão procurando" (só aparece quando 2 pessoas buscam o mesmo)
    if (results.length === 0 && q.length >= 3) {
      after(async () => { await supabase.rpc("log_search_miss", { p_condo: condo.id, p_q: q }); });
    }
    return (
      <div className="space-y-4">
        <SearchBox slug={slug} q={q} suggestions={suggestions} />
        <h2 className="font-extrabold">{results.length} resultado(s) para “{q}”</h2>
        <ListControls base={`/c/${slug}`} q={q} order={order} kind={kind} orders={["relevancia", "melhores", "avaliados", "recentes"]} />
        {results.map((p) => <ProviderCard key={p.id} slug={slug} p={p} planBadge={flags.plans} viewerCondoId={condo.id} />)}
        {results.length === 0 && (
          <div className="card space-y-3 text-center text-navy/70">
            <p>Ninguém indicado para essa busca ainda. Conhece alguém?{" "}
              <Link href={`/c/${slug}/novo?servico=${encodeURIComponent(q)}`} className="font-bold text-brand-700 underline">Indique agora</Link>.</p>
            <p className="text-sm">Anotamos sua busca: se outros vizinhos procurarem o mesmo, aparece em “Os vizinhos estão procurando” para alguém indicar.</p>
            <div className="mx-auto max-w-xs text-left"><RequestForm slug={slug} label={q} cta="🔔 Quero ser avisado por e-mail" /></div>
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
    .in("condo_id", scope)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);
  const providers = (all ?? []) as ProviderRow[];
  // Sugestões da busca: também as especialidades que existem no condomínio.
  const usedSpecialties = [...new Set(providers.flatMap((p) => p.specialty_names ?? []))];
  const searchSuggestions = [...suggestions, ...usedSpecialties.filter((n) => !suggestions.includes(n))];
  const topRated = sortProviders(providers.filter((p) => p.review_count > 0), "melhores", undefined, condo.id).slice(0, 5);
  const topIds = new Set(topRated.map((p) => p.id));
  const newest = providers.filter((p) => !topIds.has(p.id)).slice(0, 5);

  // Anúncio local (só com a chave ligada): sorteia um dos vigentes a cada visita.
  let ad: AdRow | null = null;
  if (flags.ads) {
    const { data: adsData } = await supabase.from("ads").select("*").eq("condo_id", condo.id).eq("active", true).limit(20);
    const live = ((adsData ?? []) as AdRow[]).filter((a) => adIsLive(a, todayInSaoPaulo()));
    ad = live.length ? live[Math.floor(Math.random() * live.length)] : null;
  }

  // "Como foi?": quem o morador chamou há 1 a 14 dias e ainda não avaliou (ignora a falta da migration 0020)
  const { data: promptData } = await supabase.rpc("review_prompts", { p_condo: condo.id });
  const reviewPrompts = ((promptData ?? []) as ReviewPromptItem[]);

  // "Os vizinhos estão procurando" (ignora a falta da migration 0027)
  const [{ data: reqData }, { data: updData }] = await Promise.all([
    supabase.rpc("open_requests", { p_condo: condo.id }),
    supabase.rpc("my_request_updates", { p_condo: condo.id }),
  ]);
  const openRequests = ((reqData ?? []) as OpenRequest[]).map((r) => ({ ...r, n: Number(r.n) }));
  const requestUpdates = (updData ?? []) as RequestUpdate[];

  const { count: ownedCount } = await supabase
    .from("providers").select("id", { count: "exact", head: true })
    .in("condo_id", scope).eq("owner_id", user.id);

  // Quem já cadastrou o próprio serviço e aguarda confirmação vê o andamento, e não o convite de novo.
  let pendingSelf: { id: string; name: string } | null = null;
  if ((ownedCount ?? 0) === 0) {
    const { data: mine } = await supabase
      .from("provider_listing").select("id,name").in("condo_id", scope).eq("created_by", user.id).eq("self_pending", true).limit(1);
    pendingSelf = (mine?.[0] as { id: string; name: string } | undefined) ?? null;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-brand-500 to-[#e85400] p-5 text-white shadow-md">
        <h1 className="text-2xl font-extrabold">Olá, {firstName}! 👋</h1>
        <p className="mt-1 font-semibold text-white">Precisando de alguém de confiança? Veja quem os seus vizinhos indicam.</p>
      </section>
      <SearchBox slug={slug} q="" suggestions={searchSuggestions} />

      <ReviewPrompt slug={slug} items={reviewPrompts} />

      {(ownedCount ?? 0) === 0 && <ProviderCta slug={slug} pending={pendingSelf} />}

      <InstallPrompt />

      {(ownedCount ?? 0) > 0 && (
        <Link href={`/c/${slug}/resultados`} className="card flex items-center gap-3 transition hover:border-brand-500">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xl">📊</span>
          <span className="flex-1"><b>Veja como seu perfil está indo</b><br /><span className="text-sm text-navy/65">Visitas e cliques no WhatsApp</span></span>
          <span className="text-navy/40" aria-hidden>›</span>
        </Link>
      )}
      <section>
        <h2 className="mb-3 text-lg font-extrabold">O que você procura?</h2>
        <div className="space-y-2">
          {sections.map((sec, i) => (
            <details key={sec.group.id} name="grupos-categorias" open={i === 0} className="group card !rounded-2xl !p-0 open:border-brand-500/40">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xl">{sec.group.icon}</span>
                <span className="flex-1 font-extrabold">{sec.group.name}</span>
                <span className="text-xs font-semibold text-navy/50">{sec.categories.length}</span>
                <span className="text-navy/40 transition group-open:rotate-90" aria-hidden>›</span>
              </summary>
              <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                {sec.categories.map((c) => <CategoryTile key={c.id} slug={slug} c={c} />)}
              </div>
            </details>
          ))}
        </div>
      </section>

      <NeighborsLooking slug={slug} requests={openRequests} updates={requestUpdates} isAdmin={member.role === "admin"} />

      <section className="card space-y-2 !bg-sky-soft/60">
        <h2 className="font-extrabold">👋 Quanto mais vizinhos, melhor fica</h2>
        <p className="text-sm text-navy/75">Chame os moradores do seu bloco. Com mais gente indicando e avaliando, todo mundo acha prestador bom mais rápido.</p>
        <InviteButton url={`${SITE_URL}/c/${slug}`} text={buildInviteMessage({ residentName: member.full_name, condoName: condo.name, url: `${SITE_URL}/c/${slug}` })} />
      </section>

      {ad && <AdCard slug={slug} ad={ad} />}

      {topRated.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">⭐ Mais bem avaliados do condomínio</h2>
          {topRated.map((p) => <ProviderCard key={p.id} slug={slug} p={p} planBadge={flags.plans} viewerCondoId={condo.id} />)}
        </section>
      )}
      {newest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">🆕 Indicações recentes</h2>
          {newest.map((p) => <ProviderCard key={p.id} slug={slug} p={p} planBadge={flags.plans} viewerCondoId={condo.id} />)}
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
