import Link from "next/link";
import { getFeatures, requireAdmin } from "@/lib/condo";
import type { Category, CategoryGroup, FeedbackRow, ProfileClaimRow, ProviderRow, ReviewRow } from "@/lib/types";
import { formatWhatsapp } from "@/lib/phone";
import { StatTile } from "@/components/StatTile";
import { FEATURES, FEATURE_INFO } from "@/lib/features";
import type { AdRow } from "@/lib/types";
import { AdForm } from "./AdForm";
import { KIND_BY_VALUE } from "@/lib/feedback";
import { groupCategories } from "@/lib/groups";
import { capitalizeFirst, findSimilarCategories, groupSuggestions } from "@/lib/suggestions";
import {
  adminClearFlag,
  adminDeleteAd,
  adminSetAdActive,
  adminSetFeature,
  adminDecideClaim,
  adminReplyFeedback,
  adminSetFeedbackStatus,
  adminCreateCategory,
  adminDismissSuggestion,
  adminMoveToCategory,
  adminResolveReport,
  adminSetProviderStatus,
  adminSetReviewStatus,
} from "../../actions";

type Report = {
  id: string;
  reason: string;
  created_at: string;
  provider_id: string | null;
  review_id: string | null;
};

export default async function Admin({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ anuncio?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { condo, user, supabase } = await requireAdmin(slug);
  const flags = await getFeatures(condo.id);

  const [{ data: flagged }, { data: reportsData }, { data: recent }, { count: members }] = await Promise.all([
    supabase.from("provider_listing").select("*").eq("condo_id", condo.id).eq("flagged", true).order("created_at", { ascending: false }),
    supabase.from("reports").select("*").eq("condo_id", condo.id).eq("status", "open").order("created_at", { ascending: false }),
    supabase.from("provider_listing").select("*").eq("condo_id", condo.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("members").select("*", { count: "exact", head: true }).eq("condo_id", condo.id),
  ]);
  const [{ data: pendingData }, { data: catData }, { data: groupData }] = await Promise.all([
    supabase.from("providers").select("id,name,custom_category")
      .eq("condo_id", condo.id).not("custom_category", "is", null).eq("custom_category_reviewed", false)
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
  ]);
  const groups = (groupData ?? []) as CategoryGroup[];

  type CondoStats = { days: number; totals: { views: number; viewers: number; whatsapp: number; members: number; owners: number; providers: number }; top: { id: string; name: string; whatsapp: number; views: number }[] };
  const { data: cs } = await supabase.rpc("condo_stats", { p_condo: condo.id, p_days: 30 });
  const overview = (cs ?? null) as CondoStats | null;

  // Planos ativos e anúncios (Etapa 2)
  const { data: planRows } = await supabase
    .from("provider_plans").select("provider_id,current_period_end,source")
    .eq("condo_id", condo.id).gt("current_period_end", new Date().toISOString()).order("current_period_end");
  const planNames = (planRows ?? []).length
    ? ((await supabase.from("providers").select("id,name").in("id", (planRows ?? []).map((r) => r.provider_id))).data ?? [])
    : [];
  const { data: adsData } = await supabase.from("ads").select("*").eq("condo_id", condo.id).order("created_at", { ascending: false });
  const ads = (adsData ?? []) as AdRow[];
  type AdStat = { id: string; views: number; viewers: number; clicks: number };
  const { data: adStatData } = ads.length ? await supabase.rpc("ad_stats", { p_condo: condo.id, p_days: 30 }) : { data: [] };
  const adStats = new Map(((adStatData ?? []) as AdStat[]).map((a) => [a.id, a]));
  const editingAd = sp.anuncio ? ads.find((a) => a.id === sp.anuncio) : undefined;

  // Especialidades escritas pelos moradores, aguardando análise
  const { count: specPending } = await supabase
    .from("providers").select("id", { count: "exact", head: true })
    .eq("condo_id", condo.id).not("custom_specialty", "is", null).eq("custom_specialty_reviewed", false);

  const { data: fbData } = await supabase
    .from("feedback").select("*").eq("condo_id", condo.id)
    .order("created_at", { ascending: false }).limit(60);
  const feedback = (fbData ?? []) as FeedbackRow[];
  const fbAuthors = feedback.length
    ? ((await supabase.from("members").select("user_id,full_name,block,unit").eq("condo_id", condo.id)
        .in("user_id", [...new Set(feedback.map((f) => f.user_id))])).data ?? [])
    : [];
  const authorOf = (uid: string) => {
    const m = fbAuthors.find((a) => a.user_id === uid);
    return m ? `${m.full_name} · Bloco ${m.block}, ${m.unit}` : "Morador";
  };
  const { data: claimData } = await supabase
    .from("profile_claims").select("*").eq("condo_id", condo.id).eq("status", "pending").order("created_at", { ascending: true });
  const claims = (claimData ?? []) as ProfileClaimRow[];
  const claimProviders = claims.length
    ? ((await supabase.from("providers").select("id,name,whatsapp,kind,block,created_by").in("id", claims.map((c) => c.provider_id))).data ?? [])
    : [];
  const claimMembers = claims.length
    ? ((await supabase.from("members").select("user_id,full_name,block,unit").eq("condo_id", condo.id).in("user_id", claims.map((c) => c.user_id))).data ?? [])
    : [];
  const fbNew = feedback.filter((f) => f.status === "new");
  const fbDone = feedback.filter((f) => f.status !== "new").slice(0, 15);
  const suggestions = groupSuggestions((pendingData ?? []) as { id: string; name: string; custom_category: string | null }[]);
  const allCategories = ((catData ?? []) as Category[]).filter((c) => c.slug !== "outros");
  const moveSections = groupCategories(groups, allCategories);
  const reports = (reportsData ?? []) as Report[];
  const provIds = reports.map((r) => r.provider_id).filter(Boolean) as string[];
  const revIds = reports.map((r) => r.review_id).filter(Boolean) as string[];
  const [{ data: reportedProviders }, { data: reportedReviews }] = await Promise.all([
    provIds.length ? supabase.from("providers").select("id,name,status").in("id", provIds) : Promise.resolve({ data: [] }),
    revIds.length ? supabase.from("reviews").select("id,comment,author_label,status,provider_id").in("id", revIds) : Promise.resolve({ data: [] }),
  ]);
  const pMap = new Map((reportedProviders ?? []).map((p) => [p.id as string, p]));
  const rMap = new Map((reportedReviews ?? []).map((r) => [r.id as string, r as Pick<ReviewRow, "id" | "comment" | "author_label" | "status" | "provider_id">]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">Painel admin</h1>
        <p className="text-sm text-navy/60">{members ?? 0} moradores · {(recent ?? []).length}+ prestadores recentes</p>
      </div>

      {overview && (
        <section className="space-y-3">
          <h2 className="font-semibold">📈 Visão geral do condomínio (últimos {overview.days} dias)</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Moradores que visitaram perfis" value={overview.totals.viewers} hint={`de ${overview.totals.members} cadastrados`} />
            <StatTile label="Visitas a perfis" value={overview.totals.views} />
            <StatTile label="Cliques no WhatsApp" value={overview.totals.whatsapp} />
            <StatTile label="Perfis com dono" value={overview.totals.owners} hint={`de ${overview.totals.providers} ativos`} />
          </div>
          {overview.top.length > 0 && (
            <div className="card !p-3 text-sm">
              <div className="mb-2 font-bold">Perfis com mais cliques no WhatsApp</div>
              <ol className="space-y-1">
                {overview.top.map((t, i) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{i + 1}. <Link className="underline" href={`/c/${slug}/resultados?perfil=${t.id}`}>{t.name}</Link></span>
                    <span className="shrink-0 tabular-nums text-navy/70">{t.whatsapp} cliques · {t.views} visitas</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">🧩 Funcionalidades do condomínio</h2>
        <p className="text-sm text-navy/65">Tudo começa desligado e ninguém vê nada. Ligue uma por vez, quando quiser. Qualquer chave pode ser desligada a qualquer momento.</p>
        <div className="space-y-2">
          {FEATURES.map((f) => {
            const info = FEATURE_INFO[f];
            const on = flags[f];
            return (
              <div key={f} className="card flex items-start gap-3 !p-3">
                <span className="text-2xl" aria-hidden>{info.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{info.label} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${on ? "bg-green-50 text-green-700" : "bg-navy/10 text-navy/60"}`}>{on ? "Ligado" : "Desligado"}</span></div>
                  <p className="text-sm text-navy/65">{info.description}</p>
                </div>
                <form action={adminSetFeature.bind(null, slug, f, !on)}>
                  <button className={on ? "btn-secondary !px-3 !py-2 !text-sm" : "btn !px-3 !py-2 !text-sm"}>{on ? "Desligar" : "Ligar"}</button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      {(flags.plans || (planRows ?? []).length > 0) && (
        <section className="space-y-3">
          <h2 className="font-semibold">⭐ Planos Destaque ativos ({(planRows ?? []).length})</h2>
          {(planRows ?? []).map((r) => (
            <div key={r.provider_id} className="card flex items-center justify-between gap-2 !p-3 text-sm">
              <Link className="min-w-0 truncate font-bold underline" href={`/c/${slug}/p/${r.provider_id}`}>{planNames.find((n) => n.id === r.provider_id)?.name ?? "Perfil"}</Link>
              <span className="shrink-0 text-navy/65">{r.source === "trial" ? "teste grátis" : "ativo"} · até {new Date(r.current_period_end as string).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
          {(planRows ?? []).length === 0 && <p className="text-sm text-navy/60">Nenhum plano ativo. Para conceder, abra o perfil de um prestador (botão “Conceder”).</p>}
        </section>
      )}

      {(flags.ads || ads.length > 0) && (
        <section id="anuncios" className="space-y-3">
          <h2 className="font-semibold">📢 Anunciantes locais ({ads.length}){!flags.ads && <span className="ml-2 text-xs font-normal text-navy/55">(chave desligada: nada aparece para os moradores)</span>}</h2>
          {ads.map((a) => {
            const st = adStats.get(a.id);
            const ctr = st && st.views > 0 ? Math.round((st.clicks / st.views) * 1000) / 10 : null;
            return (
              <div key={a.id} className="card space-y-2 !p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold">{a.title}</div>
                    <div className="text-navy/65">{a.advertiser}{a.starts_on || a.ends_on ? ` · ${a.starts_on ? new Date(a.starts_on + "T12:00:00").toLocaleDateString("pt-BR") : "…"} a ${a.ends_on ? new Date(a.ends_on + "T12:00:00").toLocaleDateString("pt-BR") : "sem fim"}` : ""}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${a.active ? "bg-green-50 text-green-700" : "bg-navy/10 text-navy/60"}`}>{a.active ? "Ativo" : "Pausado"}</span>
                </div>
                <p className="text-navy/75">
                  Últimos 30 dias: <b>{st?.views ?? 0}</b> exibições para <b>{st?.viewers ?? 0}</b> {(st?.viewers ?? 0) === 1 ? "pessoa" : "pessoas"} · <b>{st?.clicks ?? 0}</b> cliques{ctr !== null ? ` (${String(ctr).replace(".", ",")}%)` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/c/${slug}/admin?anuncio=${a.id}#anuncios`} className="font-bold text-sky-brand underline">Editar</Link>
                  <form action={adminSetAdActive.bind(null, slug, a.id, !a.active)}><button className="font-semibold text-navy/70 underline">{a.active ? "Pausar" : "Reativar"}</button></form>
                  <form action={adminDeleteAd.bind(null, slug, a.id)}><button className="font-semibold text-red-700 underline">Excluir</button></form>
                </div>
              </div>
            );
          })}
          <details className="card !p-3" open={Boolean(editingAd)}>
            <summary className="cursor-pointer font-bold text-sky-brand">{editingAd ? `✏️ Editando: ${editingAd.title}` : "＋ Novo anúncio"}</summary>
            <div className="mt-3"><AdForm key={editingAd?.id ?? "novo"} slug={slug} userId={user.id} ad={editingAd} /></div>
          </details>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">🙋 Pedidos para assumir perfil ({claims.length})</h2>
        {claims.map((c) => {
          const prov = claimProviders.find((x) => x.id === c.provider_id);
          const who = claimMembers.find((m) => m.user_id === c.user_id);
          return (
            <div key={c.id} className="card space-y-3">
              <p>
                <b>{who ? `${who.full_name} · Bloco ${who.block}, ${who.unit}` : "Morador"}</b> quer assumir o perfil{" "}
                <Link className="font-bold underline" href={`/c/${slug}/p/${c.provider_id}`}>{prov?.name ?? "—"}</Link>
              </p>
              {prov && (
                <p className="text-sm text-navy/70">
                  WhatsApp do perfil: <b>{formatWhatsapp(prov.whatsapp)}</b> · {prov.kind === "resident" ? `Morador${prov.block ? ` (Bloco ${prov.block})` : ""}` : "Externo"}.
                  Confirme que é a mesma pessoa (por exemplo, chamando nesse número) antes de aprovar.
                </p>
              )}
              {c.note && <p className="rounded-2xl bg-sky-soft p-3 text-sm"><b>Recado:</b> {c.note}</p>}
              <div className="flex flex-wrap gap-2">
                <form action={adminDecideClaim.bind(null, slug, c.id, true)}><button className="btn !px-4 !py-2 !text-sm">Aprovar</button></form>
                <form action={adminDecideClaim.bind(null, slug, c.id, false)}><button className="btn-secondary !px-4 !py-2 !text-sm">Recusar</button></form>
              </div>
            </div>
          );
        })}
        {claims.length === 0 && <p className="text-sm text-navy/60">Nenhum pedido pendente.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">💬 Mensagens dos moradores ({fbNew.length} nova(s))</h2>
        {fbNew.map((f) => (
          <div key={f.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
              <span className="font-extrabold">{KIND_BY_VALUE[f.kind].icon} {KIND_BY_VALUE[f.kind].label}</span>
              <span className="text-xs text-navy/50">{new Date(f.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <p className="text-sm text-navy/60">De <b>{authorOf(f.user_id)}</b>{f.reply_to ? <> · contato: <b>{f.reply_to}</b></> : null}</p>
            <p className="whitespace-pre-line">{f.message}</p>
            <form action={adminReplyFeedback.bind(null, slug, f.id)} className="space-y-2">
              <textarea name="reply" required minLength={5} maxLength={1000} rows={3} className="input" placeholder="Escreva a resposta (o morador vê na página Ajuda)" />
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn !px-4 !py-2 !text-sm">Responder</button>
              </div>
            </form>
            <form action={adminSetFeedbackStatus.bind(null, slug, f.id, "archived")}>
              <button className="text-sm font-semibold text-navy/60 underline">Arquivar sem responder</button>
            </form>
          </div>
        ))}
        {fbNew.length === 0 && <p className="text-sm text-navy/60">Nenhuma mensagem nova. 🎉</p>}
        {fbDone.length > 0 && (
          <details className="card !rounded-2xl !p-3 text-sm">
            <summary className="cursor-pointer font-bold text-sky-brand">Respondidas e arquivadas ({fbDone.length})</summary>
            <div className="mt-3 space-y-3">
              {fbDone.map((f) => (
                <div key={f.id} className="space-y-1 border-t border-navy/10 pt-3">
                  <div className="text-xs text-navy/50">{KIND_BY_VALUE[f.kind].icon} {authorOf(f.user_id)} · {new Date(f.created_at).toLocaleDateString("pt-BR")} · {f.status === "answered" ? "respondida" : "arquivada"}</div>
                  <p className="whitespace-pre-line">{f.message}</p>
                  {f.admin_reply && <p className="rounded-xl bg-sky-soft p-2 text-navy/90"><b>Resposta:</b> {f.admin_reply}</p>}
                  <form action={adminSetFeedbackStatus.bind(null, slug, f.id, "new")}>
                    <button className="text-xs font-semibold text-navy/60 underline">Reabrir</button>
                  </form>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">🏷️ Categorias sugeridas ({suggestions.length})</h2>
        <details className="card !rounded-2xl !p-3 text-sm">
          <summary className="cursor-pointer font-bold text-sky-brand">📚 Ver todas as categorias existentes ({allCategories.length})</summary>
          <div className="mt-3 space-y-3">
            {moveSections.map((sec) => (
              <div key={sec.group.id}>
                <div className="font-extrabold">{sec.group.icon} {sec.group.name}</div>
                <p className="text-navy/70">{sec.categories.map((c) => `${c.icon} ${c.name}`).join(" · ")}</p>
              </div>
            ))}
          </div>
        </details>
        {suggestions.map((g) => {
          const ids = g.items.map((i) => i.id).join(",");
          const similar = findSimilarCategories(g.label, allCategories);
          const groupName = (gid: number | null) => groups.find((x) => x.id === gid)?.name;
          return (
            <div key={g.key} className="card space-y-3">
              <div>
                <div className="text-lg font-extrabold">{g.label}</div>
                <p className="text-sm text-navy/60">
                  {g.items.length} indicação(ões):{" "}
                  {g.items.map((i, k) => (
                    <span key={i.id}>{k > 0 && ", "}<Link className="underline" href={`/c/${slug}/p/${i.id}`}>{i.name}</Link></span>
                  ))}
                </p>
              </div>
              {similar.length > 0 ? (
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-sm font-bold text-amber-800">🔎 Já existe algo parecido. Talvez não precise criar:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {similar.map((c) => (
                      <form key={c.id} action={adminMoveToCategory.bind(null, slug)}>
                        <input type="hidden" name="ids" value={ids} />
                        <input type="hidden" name="category_id" value={c.id} />
                        <button className="rounded-full border-2 border-amber-300 bg-white px-3 py-1 text-sm font-bold hover:bg-amber-100" title="Mover estes prestadores para esta categoria">
                          {c.icon} {c.name}{groupName(c.group_id) ? <span className="font-normal text-navy/50"> · {groupName(c.group_id)}</span> : null}
                          <span className="ml-1 text-brand-700">→ mover</span>
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">✅ Nenhuma categoria parecida encontrada. Pode criar.</p>
              )}
              <form action={adminCreateCategory.bind(null, slug)} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="ids" value={ids} />
                <div className="w-16">
                  <label className="label !text-xs">Ícone</label>
                  <input name="icon" defaultValue="✨" maxLength={8} className="input !px-2 !py-2 text-center" />
                </div>
                <div className="min-w-40 flex-1">
                  <label className="label !text-xs">Nome da nova categoria</label>
                  <input name="name" required minLength={2} maxLength={40} defaultValue={capitalizeFirst(g.label)} className="input !py-2" />
                </div>
                <div className="min-w-32">
                  <label className="label !text-xs">Grupo</label>
                  <select name="group_id" required defaultValue={groups[groups.length - 1]?.id} className="input !py-2">
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                  </select>
                </div>
                <button className="btn !px-3 !py-2 !text-sm">Criar e mover</button>
              </form>
              <form action={adminMoveToCategory.bind(null, slug)} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="ids" value={ids} />
                <select name="category_id" required defaultValue="" className="input min-w-40 flex-1 !py-2">
                  <option value="" disabled>Mover para categoria existente…</option>
                  {moveSections.map((sec) => (
                    <optgroup key={sec.group.id} label={`${sec.group.icon} ${sec.group.name}`}>
                      {sec.categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button className="btn-secondary !px-3 !py-2 !text-sm">Mover</button>
              </form>
              <form action={adminDismissSuggestion.bind(null, slug)}>
                <input type="hidden" name="ids" value={ids} />
                <button className="text-sm font-semibold text-navy/60 underline">Manter em “Outros” (tirar da fila)</button>
              </form>
            </div>
          );
        })}
        {suggestions.length === 0 && <p className="text-sm text-navy/60">Nenhuma sugestão pendente.</p>}
      </section>

      <Link href={`/c/${slug}/admin/categorias`} className="card flex items-center gap-3 transition hover:border-brand-500">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xl">🗂️</span>
        <span className="min-w-0 flex-1">
          <b>Categorias</b>
          <span className="block text-sm text-navy/65">Criar, editar, mover de grupo e excluir</span>
        </span>
      </Link>

      <Link href={`/c/${slug}/admin/especialidades`} className="card flex items-center gap-3 transition hover:border-brand-500">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xl">🩺</span>
        <span className="min-w-0 flex-1">
          <b>Especialidades</b>
          <span className="block text-sm text-navy/65">
            {(specPending ?? 0) > 0 ? `${specPending} ${specPending === 1 ? "sugestão aguardando" : "sugestões aguardando"} análise · ` : ""}Gerenciar a lista
          </span>
        </span>
        {(specPending ?? 0) > 0 && <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">{specPending}</span>}
        <span className="text-navy/40" aria-hidden>›</span>
      </Link>

      <section className="space-y-3">
        <h2 className="font-semibold">⚠️ Possíveis duplicidades / inconsistências ({(flagged ?? []).length})</h2>
        {((flagged ?? []) as ProviderRow[]).map((p) => (
          <div key={p.id} className="card space-y-2">
            <Link href={`/c/${slug}/p/${p.id}`} className="font-semibold underline">{p.name}</Link>
            <span className="text-sm text-navy/60"> · {p.category_name}{p.status === "hidden" ? " · OCULTO" : ""}</span>
            <p className="text-sm text-amber-800">{p.flag_reason}</p>
            <div className="flex gap-2">
              <form action={adminClearFlag.bind(null, slug, p.id)}><button className="btn-secondary !px-3 !py-2 !text-sm">Está ok</button></form>
              <form action={adminSetProviderStatus.bind(null, slug, p.id, p.status === "hidden" ? "active" : "hidden")}>
                <button className="btn-secondary !px-3 !py-2 !text-sm">{p.status === "hidden" ? "Reexibir" : "Ocultar"}</button>
              </form>
            </div>
          </div>
        ))}
        {(flagged ?? []).length === 0 && <p className="text-sm text-navy/60">Nada pendente. 🎉</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">🚩 Denúncias abertas ({reports.length})</h2>
        {reports.map((r) => {
          const prov = r.provider_id ? pMap.get(r.provider_id) : null;
          const rev = r.review_id ? rMap.get(r.review_id) : null;
          return (
            <div key={r.id} className="card space-y-2">
              <p className="text-sm text-navy/60">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
              <p><b>Motivo:</b> {r.reason}</p>
              {prov && <p className="text-sm">Prestador: <Link className="underline" href={`/c/${slug}/p/${r.provider_id}`}>{prov.name as string}</Link></p>}
              {rev && <p className="text-sm">Avaliação de {rev.author_label}: “{rev.comment || "(sem texto)"}”</p>}
              <div className="flex flex-wrap gap-2">
                {prov && r.provider_id && (
                  <form action={adminSetProviderStatus.bind(null, slug, r.provider_id, "hidden")}><button className="btn-secondary !px-3 !py-2 !text-sm">Ocultar prestador</button></form>
                )}
                {rev && r.review_id && (
                  <form action={adminSetReviewStatus.bind(null, slug, r.review_id, "hidden")}><button className="btn-secondary !px-3 !py-2 !text-sm">Ocultar avaliação</button></form>
                )}
                <form action={adminResolveReport.bind(null, slug, r.id)}><button className="btn-secondary !px-3 !py-2 !text-sm">Marcar resolvida</button></form>
              </div>
            </div>
          );
        })}
        {reports.length === 0 && <p className="text-sm text-navy/60">Sem denúncias abertas.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Últimos cadastros</h2>
        {((recent ?? []) as ProviderRow[]).map((p) => (
          <div key={p.id} className="card flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/c/${slug}/p/${p.id}`} className="block truncate font-medium underline">{p.name}</Link>
              <span className="text-xs text-navy/60">{p.category_name} · {p.review_count} aval. {p.status === "hidden" ? "· OCULTO" : ""}</span>
            </div>
            <form action={adminSetProviderStatus.bind(null, slug, p.id, p.status === "hidden" ? "active" : "hidden")}>
              <button className="btn-secondary !px-3 !py-2 !text-sm">{p.status === "hidden" ? "Reexibir" : "Ocultar"}</button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
