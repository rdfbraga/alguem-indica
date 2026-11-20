import Link from "next/link";
import { requireAdmin } from "@/lib/condo";
import { StatTile } from "@/components/StatTile";

export const metadata = { title: "Condomínios — Admin" };

type Row = {
  condo_id: string; slug: string; name: string; region_name: string | null;
  members: number; members_new: number; providers: number; reviews_new: number; whatsapp_30d: number; active_7d: number;
  pend_feedback: number; pend_claims: number; pend_flagged: number; pend_reports: number; pend_categories: number; pend_specialties: number;
};

const n = (v: number) => Number(v) || 0;
const pending = (r: Row) => n(r.pend_feedback) + n(r.pend_claims) + n(r.pend_flagged) + n(r.pend_reports) + n(r.pend_categories) + n(r.pend_specialties);

export default async function AdminCondominios({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase } = await requireAdmin(slug);
  const { data, error } = await supabase.rpc("admin_overview");
  const rows = ((data ?? []) as Row[]).sort((a, b) => pending(b) - pending(a) || a.name.localeCompare(b.name, "pt-BR"));

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
      <section className="space-y-3">
        <h2 className="font-semibold">🏘️ Todos os seus condomínios ({rows.length})</h2>
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
                  <div className="text-xs text-navy/55">{r.region_name ? `Região: ${r.region_name}` : "Sem região"} · /c/{r.slug}</div>
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
