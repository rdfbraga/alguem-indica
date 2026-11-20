import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeatures, getScope, requireMember } from "@/lib/condo";
import { formatWhatsapp } from "@/lib/phone";
import { instagramUrl, websiteLabel } from "@/lib/links";
import { reviewAuthorLabel } from "@/lib/regions";
import { InviteButton } from "@/components/InviteButton";
import { buildInviteMessage } from "@/lib/invite";
import { ViewTracker } from "@/components/ViewTracker";
import type { ProviderStats } from "@/lib/stats";
import type { Category, CategoryGroup, PhotoRow, ProviderRow, ReviewRow, ServiceRow } from "@/lib/types";
import { premiumAvailable, premiumTeaser, type PlanRow } from "@/lib/features";
import { PlanCard } from "@/components/PlanCard";
import { ShowcaseView } from "@/components/ShowcaseView";
import { ShowcaseEditor } from "./ShowcaseEditor";
import { ReplyBox } from "./ReplyBox";
import { SITE_URL } from "@/lib/site";
import { providerSpecialtyLabels, type Specialty } from "@/lib/specialties";
import { profileOrigin, shareProfileLink, shareProfileText } from "@/lib/origin";
import { Stars } from "@/components/Stars";
import { providerCategoryLabels, parseCategoryIds } from "@/lib/categories";
import { groupCategories } from "@/lib/groups";
import { addCategoriesAndReturn, adminClearOwner, adminSetProviderStatus, deleteReviewReply } from "../../../actions";
import { EditCategories } from "./EditCategories";
import { EditProfile } from "./EditProfile";
import { ClaimProfile } from "./ClaimProfile";
import { ReportButton } from "@/components/ReportButton";
import { ReviewForm } from "./ReviewForm";

export default async function Prestador({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ novo?: string; jaexiste?: string; addcat?: string; catsOk?: string; catsErro?: string; plano?: string; reivindicar?: string }>;
}) {
  const { slug, id } = await params;
  const { novo, jaexiste, addcat, catsOk, catsErro, plano, reivindicar } = await searchParams;
  const { condo, user, member, supabase } = await requireMember(slug, `/c/${slug}/p/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const scope = await getScope(condo.id);   // este condomínio + os da mesma região
  const { data } = await supabase.from("provider_listing").select("*").eq("id", id).in("condo_id", scope).maybeSingle();
  if (!data) notFound();
  const p = data as ProviderRow;
  const foreign = p.condo_id !== condo.id;   // indicado em outro condomínio da região: sem bloco/unidade, sem ações de admin
  const adminHere = member.role === "admin" && !foreign;
  const { data: rs } = await supabase
    .from("reviews").select("*").eq("provider_id", id).eq("status", "visible").order("created_at", { ascending: false });
  const reviews = (rs ?? []) as ReviewRow[];
  const mine = reviews.some((r) => r.author_id === user.id);

  // Categorias: só autor/admin editam. O aviso "já cadastrado" pode sugerir incluir uma categoria nova.
  // Com dono, só o dono (e o admin) editam; sem dono, quem indicou.
  const isOwner = p.owner_id === user.id;
  const canEdit = adminHere || (p.owner_id ? isOwner : p.created_by === user.id);
  // Resultados (últimos 7 dias): só para o dono e o admin.
  let weekStats: ProviderStats | null = null;
  if (isOwner || adminHere) {
    const { data: ws } = await supabase.rpc("provider_stats", { p_provider: id, p_days: 7 });
    weekStats = (ws ?? null) as ProviderStats | null;
  }
  let hasPendingClaim = false;
  if (!isOwner && !p.owner_id) {
    const { count } = await supabase
      .from("profile_claims").select("id", { count: "exact", head: true })
      .eq("provider_id", id).eq("user_id", user.id).eq("status", "pending");
    hasPendingClaim = (count ?? 0) > 0;
  }
  // Etapa 2: chaves, plano, vitrine e respostas (tudo desligado por padrão).
  const flags = await getFeatures(condo.id);
  const isAdmin = adminHere;
  const planActive = p.plan_active === true;
  const canShowcase = premiumAvailable(flags, planActive, "showcase");
  const canReplyHere = isOwner && premiumAvailable(flags, planActive, "replies");
  const showcaseTeaser = isOwner && premiumTeaser(flags, planActive, "showcase");
  const repliesTeaser = isOwner && premiumTeaser(flags, planActive, "replies");
  let plan: PlanRow | null = null;
  if (flags.plans && (isOwner || isAdmin)) {
    const { data: pl } = await supabase.from("provider_plans").select("current_period_end,trial_used,source,note").eq("provider_id", id).maybeSingle();
    plan = (pl ?? null) as PlanRow | null;
  }
  let services: ServiceRow[] = [];
  let photos: PhotoRow[] = [];
  if (canShowcase) {
    const [{ data: sv }, { data: ph }] = await Promise.all([
      supabase.from("provider_services").select("id,provider_id,title,description,price_text,sort").eq("provider_id", id).order("sort"),
      supabase.from("provider_photos").select("id,provider_id,url,caption,sort").eq("provider_id", id).order("sort"),
    ]);
    services = (sv ?? []) as ServiceRow[];
    photos = (ph ?? []) as PhotoRow[];
  }
  const planMsg: Record<string, [string, "ok" | "warn"]> = {
    ok: ["Teste grátis ativado! Você tem 30 dias com vitrine, fotos e respostas às avaliações. 🎉", "ok"],
    trial_used: ["O teste grátis já foi usado neste perfil.", "warn"],
    already_active: ["O plano deste perfil já está ativo.", "warn"],
    plans_off: ["O plano Destaque ainda não está disponível.", "warn"],
    not_owner: ["Só o dono do perfil pode iniciar o teste.", "warn"],
    erro: ["Não foi possível ativar o teste agora. Tente de novo.", "warn"],
  };
  const flash = plano ? planMsg[plano] : undefined;
  // Origem do perfil e compartilhamento (para quem cadastrou o próprio serviço ou já é o dono).
  const origin = profileOrigin(p);
  const isSelfRegistrant = origin === "self_pending" && p.created_by === user.id;
  const siteUrl = SITE_URL;
  const shareHref = shareProfileLink(shareProfileText({ categories: providerCategoryLabels(p), url: `${siteUrl}/c/${slug}/p/${p.id}` }));
  const askClaimHere = Boolean(reivindicar) && !isOwner && !p.owner_id && !hasPendingClaim;
  const alreadyOwned = Boolean(reivindicar) && !isOwner && Boolean(p.owner_id);
  const currentIds = p.category_ids?.length ? p.category_ids : p.category_id ? [p.category_id] : [];
  const wantedIds = parseCategoryIds((addcat ?? "").split(",")).filter((x) => !currentIds.includes(x));
  let sections: ReturnType<typeof groupCategories<CategoryGroup, Category>> = [];
  let specialties: Specialty[] = [];
  if (canEdit) {
    const { data: sd } = await supabase.from("specialties").select("id,category_id,slug,name").order("sort");
    specialties = (sd ?? []) as Specialty[];
  }
  if (canEdit || wantedIds.length) {
    const [{ data: cd }, { data: gd }] = await Promise.all([
      supabase.from("categories").select("*").order("sort"),
      supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
    ]);
    sections = groupCategories((gd ?? []) as CategoryGroup[], (cd ?? []) as Category[]) as typeof sections;
  }
  const allCats = sections.flatMap((s) => s.categories);
  const wantedNames = wantedIds.map((i) => allCats.find((c) => c.id === i)?.name).filter(Boolean) as string[];
  const mergedIds = [...currentIds, ...wantedIds];
  const mergedHasOther = allCats.some((c) => mergedIds.includes(c.id) && c.slug === "outros");

  return (
    <div className="space-y-4">
      <ViewTracker providerId={p.id} condoId={condo.id} />
      <Link href={`/c/${slug}/categoria/${p.category_slug}`} className="text-sm text-navy/60">← {p.category_name}</Link>
      {novo === "eu" ? (
        <div className="space-y-2 rounded-2xl bg-green-50 p-3 text-sm text-green-800">
          <p className="font-bold">Seu perfil está no ar! 🎉</p>
          <p>A administração vai confirmar que é você e liberar o selo ✅. Enquanto isso, complete a foto e a descrição em “Editar perfil” e peça avaliações aos vizinhos.</p>
          <a href={shareHref} target="_blank" rel="noopener noreferrer" className="btn !bg-[#25D366] !px-4 !py-2 !text-sm hover:!bg-[#1ebe57]">📲 Compartilhar meu perfil no WhatsApp</a>
        </div>
      ) : novo ? (
        <div className="space-y-2 rounded-2xl bg-green-50 p-3 text-sm text-green-800">
          <p className="font-semibold text-green-700">Indicação publicada! Obrigado por ajudar os vizinhos. 🎉</p>
          <p>Quer chamar mais vizinhos para avaliar e indicar também?</p>
          <InviteButton url={`${siteUrl}/c/${slug}`} text={buildInviteMessage({ residentName: member.full_name, condoName: condo.name, url: `${siteUrl}/c/${slug}` })} />
        </div>
      ) : null}
      {jaexiste && !reivindicar && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Este profissional já estava cadastrado. Que tal avaliá-lo?</p>}
      {askClaimHere && (
        <div className="space-y-2 rounded-2xl border-2 border-brand-500 bg-brand-50 p-3">
          <p className="font-bold">Este perfil já existe. É você? 🙋</p>
          <p className="text-sm text-navy/75">Um vizinho já indicou este número. Se é o seu serviço, peça para assumir o perfil: a administração confirma e você passa a editar tudo.</p>
          <ClaimProfile slug={slug} providerId={p.id} defaultOpen />
        </div>
      )}
      {alreadyOwned && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          Este perfil já tem dono. Se você acha que há um engano, <Link className="font-bold underline" href={`/c/${slug}/ajuda?tipo=problema&msg=${encodeURIComponent(`O perfil "${p.name}" é meu, mas já aparece com dono.`)}`}>fale com a administração</Link>.
        </p>
      )}
      {flash && <p className={`rounded-2xl p-3 text-sm font-semibold ${flash[1] === "ok" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-900"}`}>{flash[0]}</p>}
      {catsOk && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Categorias atualizadas! ✅</p>}
      {catsErro && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">Não foi possível atualizar as categorias. Tente de novo pelo botão “Editar categorias”.</p>}
      {wantedNames.length > 0 && (
        <div className="card space-y-3 !border-amber-200 !bg-amber-50">
          <p className="text-sm text-amber-900">
            Você tentou indicar <b>{p.name}</b> em <b>{wantedNames.join(", ")}</b>, mas ele(a) já está cadastrado(a) em <b>{providerCategoryLabels(p).join(", ")}</b>.
          </p>
          {canEdit && mergedIds.length <= 3 ? (
            <form action={addCategoriesAndReturn.bind(null, slug, id)} className="space-y-2">
              {mergedIds.map((cid) => <input key={cid} type="hidden" name="category_id" value={cid} />)}
              {mergedHasOther && (
                <input name="custom_category" defaultValue={p.custom_category ?? ""} required minLength={2} maxLength={40} className="input" placeholder="Qual serviço em “Outros”? Ex.: Costureira" />
              )}
              <button className="btn !px-4 !py-2 !text-sm">Incluir {wantedNames.join(", ")} neste perfil</button>
            </form>
          ) : canEdit ? (
            <p className="text-sm text-amber-900">O perfil já tem o máximo de 3 categorias. Use “Editar categorias” abaixo para trocar uma delas.</p>
          ) : (
            <p className="text-sm text-amber-900">
              Só quem indicou ou a administração pode incluir categorias.{" "}
              <Link className="font-bold underline" href={`/c/${slug}/ajuda?tipo=sugestao&msg=${encodeURIComponent(`Incluir a categoria "${wantedNames.join(", ")}" no perfil de "${p.name}".`)}`}>
                Pedir à administração
              </Link>
            </p>
          )}
        </div>
      )}
      {p.status === "hidden" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Perfil oculto (visível só para administradores).</p>}

      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-4xl">{p.category_icon}</div>
          )}
          <div>
            <h1 className="text-xl font-bold">{p.name}</h1>
            {flags.plans && planActive && (
              <span className="mr-1 mt-0.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">⭐ Destaque</span>
            )}
            {origin === "confirmed" && (
              <span className="mt-0.5 inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700" title="O próprio profissional assumiu este perfil">
                ✅ Perfil confirmado pelo próprio
              </span>
            )}
            {origin === "self_pending" && (
              <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800" title="O próprio profissional cadastrou este perfil; a administração ainda vai confirmar">
                ⏳ Cadastrado pelo próprio · aguardando confirmação
              </span>
            )}
            {foreign && <div className="text-xs font-semibold text-sky-brand">📍 Indicado em {p.condo_name ?? "um condomínio vizinho"}</div>}
            <div className="text-sm text-navy/60">
              {providerCategoryLabels(p).join(" · ")} · {p.kind === "resident" ? `Morador${p.block && !foreign ? ` (Bloco ${p.block})` : ""}` : "Externo indicado por morador"}
            </div>
            {providerSpecialtyLabels(p).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {providerSpecialtyLabels(p).map((l) => <span key={l} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{l}</span>)}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1">
              {p.review_count > 0 ? (
                <><Stars value={p.avg_rating} /><span className="text-sm text-navy/60">{Number(p.avg_rating).toFixed(1)} ({p.review_count})</span></>
              ) : <span className="text-sm text-navy/45">Sem avaliações ainda</span>}
            </div>
          </div>
        </div>
        {p.description && <p className="whitespace-pre-line text-navy/80">{p.description}</p>}
        <a href={`/c/${slug}/go/whatsapp/${p.id}`} target="_blank" rel="noopener noreferrer" className="btn w-full !bg-[#25D366] hover:!bg-[#1ebe57]">
          💬 Chamar no WhatsApp · {formatWhatsapp(p.whatsapp)}
        </a>
        {(p.instagram || p.website) && (
          <div className="flex flex-wrap gap-2">
            {p.instagram && (
              <a href={`/c/${slug}/go/instagram/${p.id}`} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary !px-4 !py-2 !text-sm" title={instagramUrl(p.instagram)}>
                📷 @{p.instagram}
              </a>
            )}
            {p.website && (
              <a href={`/c/${slug}/go/website/${p.id}`} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary !px-4 !py-2 !text-sm" title={p.website}>
                🌐 {websiteLabel(p.website)}
              </a>
            )}
          </div>
        )}
        {weekStats && (
          <Link href={`/c/${slug}/resultados${isOwner ? "" : `?perfil=${p.id}`}`} className="block rounded-2xl bg-sky-soft p-3 text-sm">
            <b>📊 Últimos 7 dias:</b> {weekStats.totals.viewers} {weekStats.totals.viewers === 1 ? "pessoa viu" : "pessoas viram"} o perfil e {weekStats.totals.whatsapp} {weekStats.totals.whatsapp === 1 ? "clique" : "cliques"} no WhatsApp.{" "}
            <span className="font-bold text-sky-brand underline">Ver resultados</span>
          </Link>
        )}
        {canEdit && (
          <details className="rounded-2xl border border-navy/10 p-3">
            <summary className="cursor-pointer text-sm font-bold text-sky-brand">✏️ Editar perfil (nome, telefone, descrição e foto)</summary>
            <EditProfile slug={slug} providerId={p.id} userId={user.id} initial={{ name: p.name, description: p.description, whatsapp: p.whatsapp, photo_url: p.photo_url, instagram: p.instagram ?? null, website: p.website ?? null }} />
          </details>
        )}
        {canEdit && sections.length > 0 && (
          <details className="rounded-2xl border border-navy/10 p-3">
            <summary className="cursor-pointer text-sm font-bold text-sky-brand">✏️ Editar categorias e especialidades</summary>
            <EditCategories slug={slug} providerId={p.id} sections={sections} initialIds={currentIds} initialCustom={p.custom_category ?? ""} specialties={specialties} initialSpecialtyIds={p.specialty_ids ?? []} initialCustomSpecialty={p.custom_specialty ?? ""} />
          </details>
        )}
        {(isOwner || isSelfRegistrant) && (
          <a href={shareHref} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-4 !py-2 !text-sm">📲 Compartilhar meu perfil no WhatsApp</a>
        )}
        {flags.plans && (isOwner || isAdmin) && <PlanCard slug={slug} provider={{ id: p.id, name: p.name }} plan={plan} isOwner={isOwner} isAdmin={isAdmin} />}
        {canShowcase && canEdit && (
          <details className="rounded-2xl border border-navy/10 p-3">
            <summary className="cursor-pointer text-sm font-bold text-sky-brand">🛍️ Editar vitrine (serviços, preços, horários e fotos)</summary>
            <ShowcaseEditor slug={slug} providerId={p.id} userId={user.id} initialHours={p.hours_text ?? ""} initialServices={services} photos={photos} />
          </details>
        )}
        {(showcaseTeaser || repliesTeaser) && (
          <p className="rounded-2xl border border-dashed border-brand-500/50 p-3 text-sm text-navy/75">
            🔒 {showcaseTeaser ? "Vitrine com serviços e preços, fotos e horários" : ""}{showcaseTeaser && repliesTeaser ? " e " : ""}{repliesTeaser ? "respostas às avaliações" : ""} fazem parte do <b>plano Destaque</b>. Veja as opções acima.
          </p>
        )}
        {isOwner && <p className="text-sm font-semibold text-green-700">Você é o dono deste perfil. 🎉</p>}
        {!isOwner && !p.owner_id && (hasPendingClaim
          ? <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">⏳ Seu pedido para assumir este perfil está em análise.</p>
          : <ClaimProfile slug={slug} providerId={p.id} />)}
        {adminHere && (
          <form action={adminSetProviderStatus.bind(null, slug, p.id, p.status === "hidden" ? "active" : "hidden")}>
            <button className="btn-secondary !px-3 !py-2 !text-sm">
              {p.status === "hidden" ? "Admin: reexibir este perfil" : "Admin: ocultar este perfil"}
            </button>
          </form>
        )}
        {adminHere && p.owner_id && (
          <form action={adminClearOwner.bind(null, slug, p.id)}>
            <button className="text-xs font-semibold text-navy/50 underline">Admin: remover vínculo do dono</button>
          </form>
        )}
        <ReportButton slug={slug} target="provider" id={p.id} />
      </div>

      {canShowcase && <ShowcaseView hours={p.hours_text ?? null} services={services} photos={photos} />}

      {!mine && <div id="avaliar" className="scroll-mt-20"><ReviewForm slug={slug} providerId={p.id} /></div>}

      <section className="space-y-3">
        <h2 className="font-semibold">Avaliações dos vizinhos ({reviews.length})</h2>
        {reviews.map((r) => (
          <div key={r.id} className="card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{reviewAuthorLabel(r, p, condo.id)}</span>
              <Stars value={r.rating} size="text-sm" />
            </div>
            {r.comment && <p className="text-navy/80">{r.comment}</p>}
            {flags.replies && r.reply_text && (
              <div className="mt-1 rounded-2xl bg-sky-soft p-3 text-sm">
                <p className="text-xs font-bold text-sky-brand">Resposta de {p.name}{r.reply_at ? ` · ${new Date(r.reply_at).toLocaleDateString("pt-BR")}` : ""}</p>
                <p className="mt-1 whitespace-pre-line text-navy/90">{r.reply_text}</p>
                {isAdmin && !isOwner && (
                  <form action={deleteReviewReply.bind(null, slug, r.id)} className="mt-1">
                    <button className="text-xs font-semibold text-red-700 underline">Admin: remover resposta</button>
                  </form>
                )}
              </div>
            )}
            {canReplyHere && <ReplyBox slug={slug} reviewId={r.id} initial={r.reply_text ?? null} />}
            <div className="flex items-center justify-between text-xs text-navy/45">
              <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
              {r.author_id !== user.id && <ReportButton slug={slug} target="review" id={r.id} />}
            </div>
          </div>
        ))}
        {reviews.length === 0 && <p className="text-sm text-navy/60">Seja o primeiro vizinho a avaliar.</p>}
      </section>
      {adminHere && p.flagged && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">⚠️ Sinalizado: {p.flag_reason}</p>
      )}
    </div>
  );
}
