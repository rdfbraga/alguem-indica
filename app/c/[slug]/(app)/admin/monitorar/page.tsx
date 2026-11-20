import Link from "next/link";
import { getFeatures, requireAdmin } from "@/lib/condo";
import { StatTile } from "@/components/StatTile";
import type { AdRow } from "@/lib/types";

export const metadata = { title: "Monitorar — Admin" };

export default async function AdminMonitorar({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { condo, supabase } = await requireAdmin(slug);
  const flags = await getFeatures(condo.id);

  type CondoStats = { days: number; totals: { views: number; viewers: number; whatsapp: number; members: number; owners: number; providers: number }; top: { id: string; name: string; whatsapp: number; views: number }[] };
  const { data: cs } = await supabase.rpc("condo_stats", { p_condo: condo.id, p_days: 30 });
  const overview = (cs ?? null) as CondoStats | null;

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

  return (
    <div className="space-y-8">
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
        <section className="space-y-3">
          <h2 className="font-semibold">📢 Desempenho dos anúncios (últimos 30 dias)</h2>
          {ads.map((a) => {
            const st = adStats.get(a.id);
            const ctr = st && st.views > 0 ? Math.round((st.clicks / st.views) * 1000) / 10 : null;
            return (
              <div key={a.id} className="card space-y-1 !p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold">{a.title}</div>
                    <div className="text-navy/65">{a.advertiser}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${a.active ? "bg-green-50 text-green-700" : "bg-navy/10 text-navy/60"}`}>{a.active ? "Ativo" : "Pausado"}</span>
                </div>
                <p className="text-navy/75">
                  <b>{st?.views ?? 0}</b> exibições para <b>{st?.viewers ?? 0}</b> {(st?.viewers ?? 0) === 1 ? "pessoa" : "pessoas"} · <b>{st?.clicks ?? 0}</b> cliques{ctr !== null ? ` (${String(ctr).replace(".", ",")}%)` : ""}
                </p>
              </div>
            );
          })}
          {ads.length === 0 && <p className="text-sm text-navy/60">Nenhum anúncio cadastrado.</p>}
        </section>
      )}
    </div>
  );
}
