import Link from "next/link";
import { requireAdmin } from "@/lib/condo";
import type { Category, CategoryGroup, ProviderRow, ReviewRow } from "@/lib/types";
import { groupCategories } from "@/lib/groups";
import { capitalizeFirst, groupSuggestions } from "@/lib/suggestions";
import {
  adminClearFlag,
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

export default async function Admin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { condo, supabase } = await requireAdmin(slug);

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
  const suggestions = groupSuggestions((pendingData ?? []) as { id: string; name: string; custom_category: string | null }[]);
  const moveSections = groupCategories(groups, ((catData ?? []) as Category[]).filter((c) => c.slug !== "outros"));
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

      <section className="space-y-3">
        <h2 className="font-semibold">🏷️ Categorias sugeridas ({suggestions.length})</h2>
        {suggestions.map((g) => {
          const ids = g.items.map((i) => i.id).join(",");
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
