import Link from "next/link";
import { getFeatures, requireAdmin } from "@/lib/condo";
import { StatTile } from "@/components/StatTile";
import { BarChart } from "@/components/BarChart";
import { blockText, parseCondoKind, placeLabels } from "@/lib/condo-kind";
import { formatBRL } from "@/lib/billing";
import { PERIODS, delta, parsePeriod } from "@/lib/stats";
import type { AdRow } from "@/lib/types";

export const metadata = { title: "Monitorar — Admin" };

type Totals = { members: number; providers: number; reviews: number; viewers: number; views: number; whatsapp: number };
type Growth = {
  days: number;
  series: { d: string; members: number; providers: number; reviews: number; viewers: number; whatsapp: number }[];
  totals: Totals;
  prev: Totals;
  snapshot: { members: number; providers: number; residents: number; owners: number; reviewed: number; reviews: number };
  engagement: { active7: number; active_period: number; returning: number; contacted: number };
  categories: { name: string; icon: string; whatsapp: number; views: number; providers: number }[];
  gaps: { name: string; icon: string; views: number; providers: number }[];
  blocks: { block: string; n: number }[];
};
type CondoStats = { top: { id: string; name: string; whatsapp: number; views: number }[] };

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Barra de progresso com o número por extenso (a barra nunca é a única informação). */
function Meter({ label, value, total, hint }: { label: string; value: number; total: number; hint?: string }) {
  const p = pct(value, total);
  return (
    <div className="card !p-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold">{label}</span>
        <span className="tabular-nums text-navy/70">{value} de {total} · {p}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy/10" role="presentation">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
      {hint && <p className="mt-1 text-xs text-navy/55">{hint}</p>}
    </div>
  );
}

export default async function AdminMonitorar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dias?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const days = parsePeriod(sp.dias);
  const { condo, supabase } = await requireAdmin(slug);
  const flags = await getFeatures(condo.id);
  const kind = parseCondoKind(condo.kind);

  const [{ data: gs }, { data: cs }] = await Promise.all([
    supabase.rpc("growth_stats", { p_condo: condo.id, p_days: days }),
    supabase.rpc("condo_stats", { p_condo: condo.id, p_days: days }),
  ]);
  const g = (gs ?? null) as Growth | null;
  const overview = (cs ?? null) as CondoStats | null;

  const { data: sumData } = await supabase.rpc("admin_payment_summary", { p_condo: condo.id, p_days: days });
  const revenue = (Array.isArray(sumData) ? sumData[0] : null) as { payments: number; total_cents: number } | null;
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
      <div className="flex gap-2" aria-label="Período">
        {PERIODS.map((d) => (
          <Link
            key={d}
            href={`/c/${slug}/admin/monitorar?dias=${d}`}
            replace
            scroll={false}
            aria-current={d === days ? "true" : undefined}
            className={`whitespace-nowrap rounded-full border-2 px-3 py-1 text-sm font-bold ${d === days ? "border-brand-500 bg-brand-500 text-white" : "border-navy/15 bg-white text-navy"}`}
          >
            {d} dias
          </Link>
        ))}
      </div>

      {!g && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          Os indicadores de crescimento precisam da migration <code>0019_growth_stats.sql</code> no Supabase.
        </p>
      )}

      {g && (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold">🌱 Crescimento (últimos {g.days} dias)</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Novos moradores" value={g.totals.members} delta={delta(g.totals.members, g.prev.members)} days={g.days} hint={`${g.snapshot.members} no total`} />
              <StatTile label="Novos prestadores" value={g.totals.providers} delta={delta(g.totals.providers, g.prev.providers)} days={g.days} hint={`${g.snapshot.providers} ativos no total`} />
              <StatTile label="Novas avaliações" value={g.totals.reviews} delta={delta(g.totals.reviews, g.prev.reviews)} days={g.days} hint={`${g.snapshot.reviews} no total`} />
              <StatTile label="Moradores que visitaram perfis" value={g.totals.viewers} delta={delta(g.totals.viewers, g.prev.viewers)} days={g.days} />
              <StatTile label="Visitas a perfis" value={g.totals.views} delta={delta(g.totals.views, g.prev.views)} days={g.days} />
              <StatTile label="Cliques no WhatsApp" value={g.totals.whatsapp} delta={delta(g.totals.whatsapp, g.prev.whatsapp)} days={g.days} hint={g.engagement.contacted > 0 ? `${g.engagement.contacted} moradores chamaram alguém` : undefined} />
            </div>
            <BarChart title="Novos moradores, por dia" points={g.series.map((x) => ({ d: x.d, value: x.members }))} one="morador" many="moradores" />
            <BarChart title="Novos prestadores, por dia" points={g.series.map((x) => ({ d: x.d, value: x.providers }))} one="prestador" many="prestadores" />
            <BarChart title="Pessoas que visitaram perfis, por dia" points={g.series.map((x) => ({ d: x.d, value: x.viewers }))} one="pessoa" many="pessoas" summary={`${g.totals.viewers} ${g.totals.viewers === 1 ? "pessoa" : "pessoas"} no período`} />
            <BarChart title="Cliques no WhatsApp, por dia" points={g.series.map((x) => ({ d: x.d, value: x.whatsapp }))} one="clique" many="cliques" />
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">🩺 Saúde da base</h2>
            <Meter label="Moradores ativos na última semana" value={g.engagement.active7} total={g.snapshot.members} hint="Abriram algum perfil nos últimos 7 dias." />
            <Meter label={`Voltaram em 2 dias diferentes (${g.days} dias)`} value={g.engagement.returning} total={Math.max(g.engagement.active_period, g.engagement.returning)} hint="Entre quem usou o app no período: quem voltou mais de um dia." />
            <Meter label="Moradores que já chamaram um prestador" value={g.engagement.contacted} total={g.snapshot.members} hint={`Cliques no WhatsApp nos últimos ${g.days} dias.`} />
            <Meter label="Perfis com avaliação" value={g.snapshot.reviewed} total={g.snapshot.providers} hint="Perfis ativos com pelo menos uma avaliação." />
            <Meter label="Perfis com dono confirmado" value={g.snapshot.owners} total={g.snapshot.providers} hint="O profissional assumiu e mantém o próprio perfil." />
            <Meter label="Prestadores que são moradores" value={g.snapshot.residents} total={g.snapshot.providers} />
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">🔎 Demanda e oferta</h2>
            <div className="card !p-3 text-sm">
              <div className="mb-2 font-bold">Categorias mais procuradas</div>
              {g.categories.length === 0 ? <p className="text-navy/60">Ainda sem visitas no período.</p> : (
                <ol className="space-y-1">
                  {g.categories.map((c, i) => (
                    <li key={c.name} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{i + 1}. {c.icon} {c.name}</span>
                      <span className="shrink-0 tabular-nums text-navy/70">{c.whatsapp} cliques · {c.views} visitas · {c.providers} perfis</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="card !p-3 text-sm">
              <div className="mb-1 font-bold">Muita procura, pouca oferta</div>
              <p className="mb-2 text-xs text-navy/60">Categorias visitadas no período que têm até 2 perfis. Boas candidatas para convidar prestadores.</p>
              {g.gaps.length === 0 ? <p className="text-navy/60">Nenhuma por enquanto.</p> : (
                <ul className="space-y-1">
                  {g.gaps.map((c) => (
                    <li key={c.name} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{c.icon} {c.name}</span>
                      <span className="shrink-0 tabular-nums text-navy/70">{c.views} visitas · {c.providers} {c.providers === 1 ? "perfil" : "perfis"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card !p-3 text-sm">
              <div className="mb-2 font-bold">{placeLabels(kind).groupTitle}</div>
              {g.blocks.length === 0 ? <p className="text-navy/60">Sem moradores.</p> : (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {g.blocks.map((b) => (
                    <li key={b.block} className="flex justify-between gap-2"><span>{blockText(kind, b.block)}</span><span className="tabular-nums text-navy/70">{b.n}</span></li>
                  ))}
                </ul>
              )}
            </div>
          {(overview?.top ?? []).length > 0 && (
            <div className="card !p-3 text-sm">
              <div className="mb-2 font-bold">Perfis com mais cliques no WhatsApp</div>
              <ol className="space-y-1">
                {(overview?.top ?? []).map((t, i) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{i + 1}. <Link className="underline" href={`/c/${slug}/resultados?perfil=${t.id}`}>{t.name}</Link></span>
                    <span className="shrink-0 tabular-nums text-navy/70">{t.whatsapp} cliques · {t.views} visitas</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          </section>
        </>
      )}

      {(flags.plans || (planRows ?? []).length > 0) && (
        <section className="space-y-3">
          <h2 className="font-semibold">⭐ Planos Destaque ativos ({(planRows ?? []).length})</h2>
          {revenue && (
            <p className="text-sm text-navy/70">Pagamentos confirmados nos últimos {days} dias: <b>{formatBRL(Number(revenue.total_cents))}</b> ({Number(revenue.payments)} {Number(revenue.payments) === 1 ? "pagamento" : "pagamentos"}).</p>
          )}
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
