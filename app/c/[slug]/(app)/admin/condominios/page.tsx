import Link from "next/link";
import { requireAdmin } from "@/lib/condo";
import { StatTile } from "@/components/StatTile";
import { naturalCompare } from "@/lib/natural";
import { KIND_LABEL, parseCondoKind } from "@/lib/condo-kind";
import { platformDeleteRegion, platformSetAdmin } from "../../../actions";
import { AddAdminByEmailForm, AutoApproveForm, EditCondoForm, NewCondoForm, RegionForm } from "./PlatformForms";

export const metadata = { title: "Condomínios — Admin" };

type Row = {
  condo_id: string; slug: string; name: string; region_name: string | null;
  members: number; members_new: number; providers: number; reviews_new: number; whatsapp_30d: number; active_7d: number;
  pend_feedback: number; pend_claims: number; pend_flagged: number; pend_reports: number; pend_categories: number; pend_specialties: number; kind?: string;
};

const n = (v: number) => Number(v) || 0;
const pending = (r: Row) => n(r.pend_feedback) + n(r.pend_claims) + n(r.pend_flagged) + n(r.pend_reports) + n(r.pend_categories) + n(r.pend_specialties);

type PCondo = { kind?: string; auto_approve_until?: string | null; id: string; slug: string; name: string; is_active: boolean; region_id: string | null; region_name: string | null; members: number; providers: number; admins: number };
type Person = { user_id: string; full_name: string; block: string; unit: string; email: string };
type PRegion = { id: string; slug: string; name: string; condos: number };

export default async function AdminCondominios({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; adm?: string; aq?: string; tipo?: string }>;
}) {
  const { slug } = await params;
  const { erro, adm, aq, tipo } = await searchParams;
  const tipoFiltro = tipo === "houses" || tipo === "building" ? tipo : null;
  const { supabase } = await requireAdmin(slug);
  const { data, error } = await supabase.rpc("admin_overview");
  // Administrador da plataforma: cria condomínios e regiões (se a migration 0024 ainda não rodou, o bloco não aparece).
  const { data: st } = await supabase.rpc("platform_status");
  const platform = (st ?? null) as { is_admin: boolean; has_any: boolean } | null;
  let pCondos: PCondo[] = [];
  let pRegions: PRegion[] = [];
  const adminsByCondo = new Map<string, Person[]>();
  let found: Person[] = [];
  if (platform?.is_admin) {
    const [c, r] = await Promise.all([supabase.rpc("platform_condos"), supabase.rpc("platform_regions")]);
    pCondos = ((c.data ?? []) as PCondo[]).sort((a, b) => naturalCompare(a.name, b.name));
    pRegions = (r.data ?? []) as PRegion[];
    const lists = await Promise.all(pCondos.map((c) => supabase.rpc("platform_condo_admins", { p_condo: c.id })));
    pCondos.forEach((c, i) => adminsByCondo.set(c.id, ((lists[i].data ?? []) as Person[])));
    const target = pCondos.find((c) => c.id === adm);
    if (target && aq && aq.trim().length >= 2) {
      const { data: f } = await supabase.rpc("platform_find_members", { p_condo: target.id, p_q: aq.trim().slice(0, 60) });
      found = (f ?? []) as Person[];
    }
  }
  const rows = ((data ?? []) as Row[]).filter((r) => !tipoFiltro || parseCondoKind(r.kind) === tipoFiltro).sort((a, b) => pending(b) - pending(a) || naturalCompare(a.name, b.name));

  if (error) {
    return (
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
        A visão unificada precisa da migration <code>0022_admin_overview.sql</code> no Supabase.
      </p>
    );
  }

  const sum = (f: (r: Row) => number) => rows.reduce((t, r) => t + f(r), 0);
  const chips = (r: Row) => [
    { label: "pedidos de perfil", v: n(r.pend_claims) },
    { label: "mensagens", v: n(r.pend_feedback) },
    { label: "denúncias", v: n(r.pend_reports) },
    { label: "inconsistências", v: n(r.pend_flagged) },
    { label: "categorias sugeridas", v: n(r.pend_categories) },
    { label: "especialidades sugeridas", v: n(r.pend_specialties) },
  ].filter((c) => c.v > 0);

  return (
    <div className="space-y-6">
      {erro === "regiao-com-condominios" && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Não dá para apagar a região: ainda há condomínios nela. Mova-os para outra região ou para nenhuma.</p>
      )}
      {erro === "ultimo-admin" && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Cada condomínio precisa ter pelo menos um administrador. Adicione outro antes de remover este.</p>
      )}
      {platform && !platform.has_any && (
        <p className="rounded-2xl bg-sky-soft p-3 text-sm text-navy/80">
          Para criar condomínios e regiões por aqui, defina quem é o administrador da plataforma: rode <code>supabase/tools/definir_admin_plataforma.sql</code> no Supabase com o seu e-mail.
        </p>
      )}
      {platform?.is_admin && (
        <section className="space-y-3">
          <h2 className="font-semibold">🛠️ Plataforma</h2>
          <details className="card !p-3">
            <summary className="cursor-pointer font-bold text-sky-brand">＋ Novo condomínio</summary>
            <div className="mt-3"><NewCondoForm slug={slug} regions={pRegions.map((r) => ({ id: r.id, name: r.name }))} /></div>
          </details>

          <div className="space-y-2">
            <div className="text-sm font-extrabold text-navy/70">Regiões ({pRegions.length})</div>
            {pRegions.map((r) => (
              <details key={r.id} className="card !p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="font-bold">🗺️ {r.name}</span>
                  <span className="shrink-0 text-xs text-navy/55">{Number(r.condos)} {Number(r.condos) === 1 ? "condomínio" : "condomínios"}</span>
                </summary>
                <div className="mt-3 space-y-3 rounded-2xl bg-sky-soft p-3">
                  <RegionForm slug={slug} region={{ id: r.id, slug: r.slug, name: r.name }} />
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-red-700">Apagar esta região</summary>
                    <form action={platformDeleteRegion.bind(null, slug, r.id)} className="mt-2 space-y-2">
                      <p className="text-navy/75">{Number(r.condos) > 0 ? "Ainda há condomínios nesta região: mova-os antes." : "Nenhum condomínio nela."} Não dá para desfazer.</p>
                      <button disabled={Number(r.condos) > 0} className="btn-secondary !border-red-300 !px-3 !py-2 !text-sm !text-red-700 disabled:opacity-40">Sim, apagar</button>
                    </form>
                  </details>
                </div>
              </details>
            ))}
            <details className="card !p-3">
              <summary className="cursor-pointer font-bold text-sky-brand">＋ Nova região</summary>
              <div className="mt-3"><RegionForm slug={slug} /></div>
            </details>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-extrabold text-navy/70">Condomínios da plataforma ({pCondos.length})</div>
            {pCondos.map((c) => (
              <details key={c.id} className="card !p-3" open={adm === c.id}>
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-bold">{c.name}{!c.is_active && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 align-middle text-[10px] font-bold text-red-700">INATIVO</span>}</span>
                  <span className="shrink-0 text-xs text-navy/55">{KIND_LABEL[parseCondoKind(c.kind)]} · {Number(c.members)} moradores · {c.region_name ?? "sem região"}</span>
                </summary>
                <div className="mt-3 space-y-3 rounded-2xl bg-sky-soft p-3">
                  <p className="text-xs text-navy/60">Link: /c/{c.slug} · {Number(c.providers)} prestadores · {Number(c.admins)} {Number(c.admins) === 1 ? "administrador" : "administradores"}</p>
                  <EditCondoForm slug={slug} condo={{ id: c.id, name: c.name, region_id: c.region_id, is_active: c.is_active, kind: parseCondoKind(c.kind) }} regions={pRegions.map((r) => ({ id: r.id, name: r.name }))} />

                  <div className="border-t border-navy/10 pt-3">
                    <AutoApproveForm slug={slug} condoId={c.id} until={c.auto_approve_until ?? null} />
                  </div>

                  <div className="space-y-2 border-t border-navy/10 pt-3">
                    <div className="text-sm font-extrabold">Administradores ({(adminsByCondo.get(c.id) ?? []).length})</div>
                    <ul className="space-y-1.5">
                      {(adminsByCondo.get(c.id) ?? []).map((a) => (
                        <li key={a.user_id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0"><b className="block truncate">{a.full_name}</b><span className="block truncate text-xs text-navy/55">{a.email}</span></span>
                          <form action={platformSetAdmin.bind(null, slug, c.id, a.user_id, false)}>
                            <button className="shrink-0 text-xs font-semibold text-red-700 underline">Remover</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                    <form method="get" className="space-y-1">
                      <input type="hidden" name="adm" value={c.id} />
                      <label className="label !text-xs" htmlFor={`aq-${c.id}`}>Procurar morador deste condomínio</label>
                      <div className="flex gap-2">
                        <input id={`aq-${c.id}`} name="aq" defaultValue={adm === c.id ? aq : ""} minLength={2} className="input !py-2" placeholder="nome ou e-mail" />
                        <button className="btn-secondary !px-3 !py-2 !text-sm">Procurar</button>
                      </div>
                    </form>
                    {adm === c.id && aq && (
                      found.length > 0 ? (
                        <ul className="space-y-1.5">
                          {found.map((f) => (
                            <li key={f.user_id} className="flex items-center justify-between gap-2 text-sm">
                              <span className="min-w-0"><b className="block truncate">{f.full_name}</b><span className="block truncate text-xs text-navy/55">Bloco {f.block}, {f.unit} · {f.email}</span></span>
                              <form action={platformSetAdmin.bind(null, slug, c.id, f.user_id, true)}>
                                <button className="btn !px-3 !py-1.5 !text-xs">Tornar administrador</button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-xs text-navy/60">Nenhum morador encontrado (quem já é administrador não aparece).</p>
                    )}
                    <AddAdminByEmailForm slug={slug} condoId={c.id} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">🏘️ Todos os seus condomínios ({rows.length})</h2>
        <div className="flex flex-wrap gap-2 text-sm" aria-label="Filtrar por tipo">
          {([["", "Todos"], ["building", KIND_LABEL.building], ["houses", KIND_LABEL.houses]] as const).map(([v, label]) => (
            <Link key={v} href={v ? `/c/${slug}/admin/condominios?tipo=${v}` : `/c/${slug}/admin/condominios`} replace scroll={false}
              aria-current={(tipoFiltro ?? "") === v ? "true" : undefined}
              className={`rounded-full border-2 px-3 py-1 font-bold ${(tipoFiltro ?? "") === v ? "border-brand-500 bg-brand-500 text-white" : "border-navy/15 bg-white text-navy"}`}>{label}</Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Moradores cadastrados" value={sum((r) => n(r.members))} hint={`+${sum((r) => n(r.members_new))} nos últimos 30 dias`} />
          <StatTile label="Prestadores ativos" value={sum((r) => n(r.providers))} />
          <StatTile label="Moradores ativos na semana" value={sum((r) => n(r.active_7d))} hint="Abriram algum perfil nos últimos 7 dias." />
          <StatTile label="Pendências" value={sum(pending)} hint="Somando todos os condomínios." />
        </div>
      </section>

      <section className="space-y-3">
        {rows.map((r) => {
          const p = pending(r);
          const active = pct(n(r.active_7d), n(r.members));
          return (
            <div key={r.condo_id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-extrabold">{r.name}{r.condo_id && r.slug === slug ? <span className="ml-2 rounded-full bg-sky-soft px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-sky-brand">você está aqui</span> : null}</div>
                  <div className="text-xs text-navy/55">{KIND_LABEL[parseCondoKind(r.kind)]} · {r.region_name ? `Região: ${r.region_name}` : "Sem região"} · /c/{r.slug}</div>
                </div>
                {p > 0 && <span className="shrink-0 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">{p}</span>}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-sky-soft p-2"><dd className="text-xl font-extrabold">{n(r.members)}</dd><dt className="text-[11px] text-navy/60">moradores (+{n(r.members_new)})</dt></div>
                <div className="rounded-xl bg-sky-soft p-2"><dd className="text-xl font-extrabold">{n(r.providers)}</dd><dt className="text-[11px] text-navy/60">prestadores</dt></div>
                <div className="rounded-xl bg-sky-soft p-2"><dd className="text-xl font-extrabold">{n(r.active_7d)}</dd><dt className="text-[11px] text-navy/60">ativos na semana ({active}%)</dt></div>
              </dl>
              <p className="text-xs text-navy/60">Últimos 30 dias: {n(r.reviews_new)} avaliações · {n(r.whatsapp_30d)} cliques no WhatsApp</p>
              {p > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {chips(r).map((c) => (
                    <span key={c.label} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">{c.v} {c.label}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-green-700">✅ Nada pendente.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={`/c/${r.slug}/admin`} className="btn !px-3 !py-2 !text-sm">{p > 0 ? "Moderar" : "Abrir painel"}</Link>
                <Link href={`/c/${r.slug}/admin/monitorar`} className="btn-secondary !px-3 !py-2 !text-sm">Monitorar</Link>
                <Link href={`/c/${r.slug}/admin/configurar`} className="btn-secondary !px-3 !py-2 !text-sm">Configurar</Link>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-navy/60">Nenhum condomínio encontrado.</p>}
      </section>
    </div>
  );
}

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}
