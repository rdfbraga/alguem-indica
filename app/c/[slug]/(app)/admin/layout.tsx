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
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Painel admin</h1>
      <AdminTabs slug={slug} pending={pending} />
      {children}
    </div>
  );
}
