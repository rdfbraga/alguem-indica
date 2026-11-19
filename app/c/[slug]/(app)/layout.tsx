import Link from "next/link";
import { requireMember } from "@/lib/condo";
import { Logo } from "@/components/Logo";
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
  let newMessages = 0;
  if (member.role === "admin") {
    const { count } = await supabase
      .from("feedback").select("id", { count: "exact", head: true })
      .eq("condo_id", condo.id).eq("status", "new");
    const { count: claimCount } = await supabase
      .from("profile_claims").select("id", { count: "exact", head: true })
      .eq("condo_id", condo.id).eq("status", "pending");
    newMessages = (count ?? 0) + (claimCount ?? 0);
  }
  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <Logo href={`/c/${slug}`} />
          <div className="mt-0.5 truncate pl-[3.1rem] text-xs font-semibold text-sky-brand">{condo.name}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {member.role === "admin" && (
            <Link href={`/c/${slug}/admin`} className="rounded-xl bg-sky-soft px-2.5 py-1 font-bold text-sky-brand">
              Admin{newMessages > 0 && <span className="ml-1 rounded-full bg-brand-500 px-1.5 text-xs text-white">{newMessages}</span>}
            </Link>
          )}
          <Link href={`/c/${slug}/ajuda`} className="flex items-center gap-1 whitespace-nowrap font-semibold text-navy/60 hover:text-navy" aria-label="Ajuda e contato">💬 <span>Ajuda</span></Link>
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
