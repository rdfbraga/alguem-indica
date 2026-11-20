import Link from "next/link";
import { requireAdmin } from "@/lib/condo";
import type { Category, CategoryGroup, FeedbackRow, ProfileClaimRow, ProviderRow, ReviewRow } from "@/lib/types";
import { formatWhatsapp } from "@/lib/phone";
import { KIND_BY_VALUE } from "@/lib/feedback";
import { groupCategories } from "@/lib/groups";
import { capitalizeFirst, findSimilarCategories, groupSuggestions } from "@/lib/suggestions";
import {
  adminClearFlag,
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

export const metadata = { title: "Moderar — Admin" };

export default async function AdminModerar({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { condo, supabase } = await requireAdmin(slug);

  const [{ data: flagged }, { data: reportsData }, { data: recent }] = await Promise.all([
    supabase.from("provider_listing").select("*").eq("condo_id", condo.id).eq("flagged", true).order("created_at", { ascending: false }),
    supabase.from("reports").select("*").eq("condo_id", condo.id).eq("status", "open").order("created_at", { ascending: false }),
    supabase.from("provider_listing").select("*").eq("condo_id", condo.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const [{ data: pendingData }, { data: catData }, { data: groupData }] = await Promise.all([
    supabase.from("providers").select("id,name,custom_category")
      .eq("condo_id", condo.id).not("custom_category", "is", null).eq("custom_category_reviewed", false)
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
  ]);
  const groups = (groupData ?? []) as CategoryGroup[];

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

      <Link href={`/c/${slug}/admin/especialidades`} className="card flex items-center gap-3 transition hover:border-brand-500">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xl">🩺</span>
        <span className="min-w-0 flex-1">
          <b>Especialidades sugeridas ({specPending ?? 0})</b>
          <span className="block text-sm text-navy/65">
            {(specPending ?? 0) > 0 ? "Moradores escreveram em “Outra especialidade”. Toque para analisar." : "Nenhuma sugestão aguardando."}
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
