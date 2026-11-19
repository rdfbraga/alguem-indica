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
  const { condo, member } = await requireMember(slug);
  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <Logo href={`/c/${slug}`} />
          <div className="mt-0.5 truncate pl-[3.1rem] text-xs font-semibold text-sky-brand">{condo.name}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {member.role === "admin" && (
            <Link href={`/c/${slug}/admin`} className="rounded-xl bg-sky-soft px-2.5 py-1 font-bold text-sky-brand">Admin</Link>
          )}
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
