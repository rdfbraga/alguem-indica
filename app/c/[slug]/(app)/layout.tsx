import Link from "next/link";
import { requireMember } from "@/lib/condo";
import { Logo } from "@/components/Logo";
import { CondoSwitcher, type MyCondo } from "@/components/CondoSwitcher";
import { getRegionInfo } from "@/lib/condo";
import { signOut } from "../actions";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { condo, member, supabase } = await requireMember(slug);
  // Troca de condomínio: os condomínios da pessoa e, se houver região, o caminho para entrar em outro (ignora a falta da migration 0032)
  const { data: mineData } = await supabase.rpc("my_condos");
  const myCondos = ((mineData ?? []) as { slug: string; name: string }[]).map((c): MyCondo => ({ slug: c.slug, name: c.name }));
  const region = await getRegionInfo(condo.id);
  // "Meu perfil": quem é dono de um perfil, ou cadastrou o próprio e aguarda confirmação
  const user = (await supabase.auth.getUser()).data.user;
  let hasProfile = false;
  if (user) {
    const [{ count: owned }, { count: pendingClaims }] = await Promise.all([
      supabase.from("providers").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
      supabase.from("profile_claims").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
    ]);
    hasProfile = (owned ?? 0) > 0 || (pendingClaims ?? 0) > 0;
  }
  let newMessages = 0;
  if (member.role === "admin") {
    const { count } = await supabase
      .from("feedback").select("id", { count: "exact", head: true })
      .eq("condo_id", condo.id).eq("status", "new");
    const { count: claimCount } = await supabase
      .from("profile_claims").select("id", { count: "exact", head: true })
      .eq("condo_id", condo.id).eq("status", "pending");
    const { count: specCount } = await supabase
      .from("providers").select("id", { count: "exact", head: true })
      .eq("condo_id", condo.id).not("custom_specialty", "is", null).eq("custom_specialty_reviewed", false);
    const head = { count: "exact", head: true } as const;
    const [flagged, reports, catCount] = await Promise.all([
      supabase.from("providers").select("id", head).eq("condo_id", condo.id).eq("flagged", true),
      supabase.from("reports").select("id", head).eq("condo_id", condo.id).eq("status", "open"),
      supabase.from("providers").select("id", head).eq("condo_id", condo.id).not("custom_category", "is", null).eq("custom_category_reviewed", false),
    ]);
    newMessages = (count ?? 0) + (claimCount ?? 0) + (specCount ?? 0) + (flagged.count ?? 0) + (reports.count ?? 0) + (catCount.count ?? 0);
  }
  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <Logo href={`/c/${slug}`} />
          <CondoSwitcher current={{ slug, name: condo.name }} condos={myCondos.length ? myCondos : [{ slug, name: condo.name }]} regionSlug={region?.slug ?? null} />
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {hasProfile && (
            <Link href={`/c/${slug}/meu-perfil`} className="rounded-xl bg-brand-50 px-2.5 py-1 font-bold text-brand-700">🧰 Meu perfil</Link>
          )}
          {member.role === "admin" && (
            <Link href={`/c/${slug}/admin`} className="rounded-xl bg-sky-soft px-2.5 py-1 font-bold text-sky-brand">
              Admin{newMessages > 0 && <span className="ml-1 rounded-full bg-brand-500 px-1.5 text-xs text-white">{newMessages}</span>}
            </Link>
          )}
          <Link href={`/c/${slug}/ajuda`} className="flex items-center gap-1 whitespace-nowrap font-semibold text-navy/60 hover:text-navy" aria-label="Ajuda e contato">💬 <span className={hasProfile ? "hidden sm:inline" : ""}>Ajuda</span></Link>
          <form action={signOut.bind(null, slug)}>
            <button className="font-semibold text-navy/60 hover:text-navy">Sair</button>
          </form>
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
      <Link
        href={`/c/${slug}/novo`}
        className="btn fixed bottom-5 left-1/2 z-10 -translate-x-1/2 shadow-lg"
      >
        ＋ Indicar um profissional
      </Link>
    </div>
  );
}
