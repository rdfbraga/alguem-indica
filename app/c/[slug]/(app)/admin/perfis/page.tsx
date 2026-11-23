import Link from "next/link";
import { requireAdmin } from "@/lib/condo";
import type { Category, CategoryGroup, ProviderRow } from "@/lib/types";
import { groupCategories } from "@/lib/groups";
import { naturalCompare } from "@/lib/natural";
import { providerCategoryLabels } from "@/lib/categories";
import { formatWhatsapp } from "@/lib/phone";
import { adminClearProvidersFlags, adminSetProvidersStatus } from "../../../actions";
import { ProfilesList, type ProfileRow } from "./ProfilesList";

export const metadata = { title: "Perfis — Admin" };

const PAGE = 30;
const ESTADO = { ativos: "Ativos", ocultos: "Ocultos", inconsistencia: "Com inconsistência" } as const;
const DONO = { sem: "Sem dono", pendente: "Aguardando confirmação", confirmado: "Dono confirmado" } as const;
const ORIGEM = { morador: "Moradores", externo: "Externos" } as const;
const AVAL = { sem: "Sem avaliação", baixa: "Nota baixa (até 3)" } as const;
const ORDEM = { recentes: "Mais recentes", nome: "Nome (A–Z)", melhores: "Melhor nota", piores: "Pior nota", avaliados: "Mais avaliados" } as const;

type SP = { q?: string; estado?: string; dono?: string; origem?: string; aval?: string; cat?: string; condo?: string; ordem?: string; pagina?: string };
const pick = <T extends Record<string, string>>(map: T, v?: string) => (v && v in map ? (v as keyof T & string) : undefined);

export default async function AdminPerfis({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(slug);

  // condomínios que a pessoa administra (a lista junta todos)
  const { data: ov } = await supabase.rpc("admin_overview");
  const condos = ((ov ?? []) as { condo_id: string; slug: string; name: string }[]).map((c) => ({ id: c.condo_id, slug: c.slug, name: c.name })).sort((a, b) => naturalCompare(a.name, b.name));
  const condoIds = condos.length ? condos.map((c) => c.id) : [];
  const bySlug = new Map(condos.map((c) => [c.id, c]));

  const q = (sp.q ?? "").trim().slice(0, 60);
  const estado = pick(ESTADO, sp.estado);
  const dono = pick(DONO, sp.dono);
  const origem = pick(ORIGEM, sp.origem);
  const aval = pick(AVAL, sp.aval);
  const ordem = pick(ORDEM, sp.ordem) ?? "recentes";
  const condoFilter = condos.find((c) => c.id === sp.condo)?.id;
  const page = Math.max(1, Math.floor(Number(sp.pagina)) || 1);

  const [{ data: catData }, { data: groupData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
  ]);
  const categories = (catData ?? []) as Category[];
  const sections = groupCategories((groupData ?? []) as CategoryGroup[], categories);
  const catFilter = categories.find((c) => c.slug === sp.cat)?.slug;

  let query = supabase.from("provider_listing").select("*", { count: "exact" }).in("condo_id", condoFilter ? [condoFilter] : condoIds);
  if (q) {
    // Busca sem acento e com tolerância a erro de digitação (função do banco)
    const { data: ids } = await supabase.rpc("find_provider_ids", { p_condos: condoFilter ? [condoFilter] : condoIds, p_q: q, p_limit: 50 });
    const found = ((ids ?? []) as { id: string }[]).map((r) => r.id);
    query = query.in("id", found.length ? found : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (estado === "ativos") query = query.eq("status", "active");
  if (estado === "ocultos") query = query.eq("status", "hidden");
  if (estado === "inconsistencia") query = query.eq("flagged", true);
  if (dono === "confirmado") query = query.not("owner_id", "is", null);
  if (dono === "sem") query = query.is("owner_id", null).eq("self_pending", false);
  if (dono === "pendente") query = query.is("owner_id", null).eq("self_pending", true);
  if (origem) query = query.eq("kind", origem === "morador" ? "resident" : "external");
  if (aval === "sem") query = query.eq("review_count", 0);
  if (aval === "baixa") query = query.gt("review_count", 0).lte("avg_rating", 3);
  if (catFilter) query = query.contains("category_slugs", [catFilter]);
  if (ordem === "nome") query = query.order("name", { ascending: true });
  else if (ordem === "melhores") query = query.gt("review_count", 0).order("avg_rating", { ascending: false }).order("review_count", { ascending: false });
  else if (ordem === "piores") query = query.gt("review_count", 0).order("avg_rating", { ascending: true }).order("review_count", { ascending: false });
  else if (ordem === "avaliados") query = query.order("review_count", { ascending: false }).order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  const from = (page - 1) * PAGE;
  const { data, count } = await query.range(from, from + PAGE - 1);
  const list = (data ?? []) as ProviderRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const { data: clickData } = list.length ? await supabase.rpc("admin_provider_clicks", { p_ids: list.map((p) => p.id) }) : { data: [] };
  const clicks = clickData ? new Map(((clickData as { provider_id: string; whatsapp: number }[])).map((c) => [c.provider_id, Number(c.whatsapp)])) : null;

  const rows: ProfileRow[] = list.map((p) => ({
    id: p.id,
    name: p.name,
    photo_url: p.photo_url,
    category: providerCategoryLabels(p).join(" · "),
    icon: p.category_icon,
    condo: bySlug.get(p.condo_id)?.name ?? p.condo_name ?? "",
    condoSlug: bySlug.get(p.condo_id)?.slug ?? slug,
    hidden: p.status === "hidden",
    flagged: p.flagged,
    flagReason: p.flag_reason,
    owner: p.owner_id ? "confirmed" : p.self_pending ? "pending" : "none",
    kind: p.kind,
    rating: Number(p.avg_rating),
    reviews: p.review_count,
    whatsapp: formatWhatsapp(p.whatsapp),
    clicks: clicks ? (clicks.get(p.id) ?? 0) : null,
    createdAt: p.created_at,
  }));

  const params2 = (over: Record<string, string | undefined>) => {
    const base: Record<string, string | undefined> = { q: q || undefined, estado, dono, origem, aval, cat: catFilter, condo: condoFilter, ordem: ordem === "recentes" ? undefined : ordem, ...over };
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v) usp.set(k, v);
    const s = usp.toString();
    return `/c/${slug}/admin/perfis${s ? `?${s}` : ""}`;
  };
  const hasFilter = Boolean(q || estado || dono || origem || aval || catFilter || condoFilter);

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">👥 Perfis ({total}){condos.length > 1 && !condoFilter ? ` · ${condos.length} condomínios` : ""}</h2>

      <form method="get" className="card space-y-2 !p-3">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou WhatsApp" className="input !py-2" aria-label="Buscar perfis" />
        <div className="grid grid-cols-2 gap-2">
          <select name="estado" defaultValue={estado ?? ""} className="input !py-2" aria-label="Estado">
            <option value="">Estado: todos</option>
            {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="dono" defaultValue={dono ?? ""} className="input !py-2" aria-label="Dono do perfil">
            <option value="">Dono: todos</option>
            {Object.entries(DONO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="origem" defaultValue={origem ?? ""} className="input !py-2" aria-label="Origem">
            <option value="">Origem: todas</option>
            {Object.entries(ORIGEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="aval" defaultValue={aval ?? ""} className="input !py-2" aria-label="Avaliações">
            <option value="">Avaliações: todas</option>
            {Object.entries(AVAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="cat" defaultValue={catFilter ?? ""} className="input !py-2" aria-label="Categoria">
            <option value="">Categoria: todas</option>
            {sections.map((sec) => (
              <optgroup key={sec.group.id} label={`${sec.group.icon} ${sec.group.name}`}>
                {sec.categories.map((c) => <option key={c.id} value={c.slug}>{c.icon} {c.name}</option>)}
              </optgroup>
            ))}
          </select>
          {condos.length > 1 ? (
            <select name="condo" defaultValue={condoFilter ?? ""} className="input !py-2" aria-label="Condomínio">
              <option value="">Condomínio: todos</option>
              {condos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <span />}
          <select name="ordem" defaultValue={ordem} className="input !py-2" aria-label="Ordenar por">
            {Object.entries(ORDEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn !px-4 !py-2 !text-sm">Filtrar</button>
          {hasFilter && <Link href={`/c/${slug}/admin/perfis`} className="text-sm font-semibold text-navy/60 underline">Limpar filtros</Link>}
        </div>
      </form>

      {rows.length > 0 ? (
        <ProfilesList
          rows={rows}
          showCondo={condos.length > 1}
          onHide={adminSetProvidersStatus.bind(null, slug, "hidden")}
          onShow={adminSetProvidersStatus.bind(null, slug, "active")}
          onOk={adminClearProvidersFlags.bind(null, slug)}
        />
      ) : (
        <p className="card text-center text-sm text-navy/65">Nenhum perfil com esses filtros.</p>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Páginas">
          {page > 1 ? <Link href={params2({ pagina: String(page - 1) })} className="btn-secondary !px-3 !py-2 !text-sm">← Anterior</Link> : <span />}
          <span className="text-navy/60">Página {page} de {pages}</span>
          {page < pages ? <Link href={params2({ pagina: String(page + 1) })} className="btn-secondary !px-3 !py-2 !text-sm">Próxima →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
