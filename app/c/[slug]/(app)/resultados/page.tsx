import Link from "next/link";
import { requireMember } from "@/lib/condo";
import { PERIODS, parsePeriod, type ProviderStats } from "@/lib/stats";
import { ResultsCard } from "@/components/ResultsCard";

export const metadata = { title: "Resultados — Alguém indica?" };

type Owned = { id: string; name: string; instagram: string | null; website: string | null };

export default async function Resultados({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ dias?: string; perfil?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const days = parsePeriod(sp.dias);
  const { condo, user, member, supabase } = await requireMember(slug);

  // Dono: seus perfis. Admin: pode abrir qualquer perfil com ?perfil=<id>.
  let profiles: Owned[] = [];
  if (member.role === "admin" && sp.perfil && /^[0-9a-f-]{36}$/i.test(sp.perfil)) {
    const { data } = await supabase.from("providers").select("id,name,instagram,website").eq("id", sp.perfil).eq("condo_id", condo.id);
    profiles = (data ?? []) as Owned[];
  } else {
    const { data } = await supabase
      .from("providers").select("id,name,instagram,website")
      .eq("condo_id", condo.id).eq("owner_id", user.id).order("name").limit(5);
    profiles = (data ?? []) as Owned[];
  }

  const results = await Promise.all(
    profiles.map(async (p) => {
      const { data } = await supabase.rpc("provider_stats", { p_provider: p.id, p_days: days });
      return { p, stats: (data ?? null) as ProviderStats | null };
    }),
  );

  const keep = sp.perfil ? `&perfil=${sp.perfil}` : "";
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold">📊 Resultados do seu perfil</h1>
        <p className="muted">Veja quantos vizinhos viram seu perfil e quantos tocaram para chamar você.</p>
      </header>

      <div className="flex gap-2" aria-label="Período">
        {PERIODS.map((d) => (
          <Link
            key={d}
            href={`/c/${slug}/resultados?dias=${d}${keep}`}
            replace
            scroll={false}
            aria-current={d === days ? "true" : undefined}
            className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${d === days ? "border-brand-500 bg-brand-500 text-white" : "border-navy/15 bg-white text-navy"}`}
          >
            Últimos {d} dias
          </Link>
        ))}
      </div>

      {results.map(({ p, stats }) =>
        stats ? (
          <ResultsCard key={p.id} slug={slug} profile={p} stats={stats} />
        ) : (
          <p key={p.id} className="card text-navy/70">Os resultados de <b>{p.name}</b> ainda não estão disponíveis.</p>
        ),
      )}

      {results.length === 0 && (
        <div className="card space-y-2 text-center">
          <p className="text-3xl">🙋</p>
          <p className="font-bold">Você ainda não é dono de nenhum perfil</p>
          <p className="text-sm text-navy/70">
            Quando você assumir um perfil (botão “Este perfil é meu” na página dele), os resultados aparecem aqui.
          </p>
        </div>
      )}

      <p className="text-xs text-navy/55">
        “Pessoas” conta cada vizinho uma vez por dia. Suas próprias visitas não entram na conta, e você nunca vê quem foi: só os totais.
      </p>
    </div>
  );
}
