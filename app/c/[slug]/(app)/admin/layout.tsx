import { requireAdmin } from "@/lib/condo";
import { AdminTabs } from "./AdminTabs";

/** Moldura do painel: três áreas — Moderar (o que pede ação), Monitorar (números) e Configurar (listas e chaves). */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { condo, supabase } = await requireAdmin(slug);
  const head = { count: "exact", head: true } as const;
  const [fb, claims, flagged, reports, cat, spec] = await Promise.all([
    supabase.from("feedback").select("id", head).eq("condo_id", condo.id).eq("status", "new"),
    supabase.from("profile_claims").select("id", head).eq("condo_id", condo.id).eq("status", "pending"),
    supabase.from("providers").select("id", head).eq("condo_id", condo.id).eq("flagged", true),
    supabase.from("reports").select("id", head).eq("condo_id", condo.id).eq("status", "open"),
    supabase.from("providers").select("id", head).eq("condo_id", condo.id).not("custom_category", "is", null).eq("custom_category_reviewed", false),
    supabase.from("providers").select("id", head).eq("condo_id", condo.id).not("custom_specialty", "is", null).eq("custom_specialty_reviewed", false),
  ]);
  const pending = [fb, claims, flagged, reports, cat, spec].reduce((n, r) => n + (r.count ?? 0), 0);
  // Quem administra mais de um condomínio ganha a aba "Condomínios" (se a migration 0022 ainda não rodou, a aba não aparece).
  const { data: ov } = await supabase.rpc("admin_overview");
  const rows = ((ov ?? []) as { condo_id: string; pend_feedback: number; pend_claims: number; pend_flagged: number; pend_reports: number; pend_categories: number; pend_specialties: number }[]);
  const { data: st } = await supabase.rpc("platform_status");
  const platform = (st ?? null) as { is_admin: boolean; has_any: boolean } | null;
  const showCondos = rows.length > 1 || platform?.is_admin === true || (platform !== null && !platform.has_any);
  const otherPending = rows.filter((r) => r.condo_id !== condo.id)
    .reduce((n, r) => n + Number(r.pend_feedback) + Number(r.pend_claims) + Number(r.pend_flagged) + Number(r.pend_reports) + Number(r.pend_categories) + Number(r.pend_specialties), 0);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Painel admin</h1>
      <AdminTabs slug={slug} pending={pending} multi={showCondos} otherPending={otherPending} />
      {children}
    </div>
  );
}
