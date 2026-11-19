import Link from "next/link";
import { requireMember } from "@/lib/condo";
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
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Link href={`/c/${slug}`} className="leading-tight">
          <div className="text-lg font-bold text-brand-700">Alguém Indica</div>
          <div className="text-xs text-stone-500">{condo.name}</div>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {member.role === "admin" && (
            <Link href={`/c/${slug}/admin`} className="rounded-lg bg-amber-100 px-2 py-1 font-medium text-amber-800">Admin</Link>
          )}
          <form action={signOut.bind(null, slug)}>
            <button className="text-stone-500 hover:text-stone-800">Sair</button>
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
