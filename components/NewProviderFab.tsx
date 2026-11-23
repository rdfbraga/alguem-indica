"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Botão flutuante "Indicar um profissional". Fica escondido no painel Admin, onde cobria gráficos e listas. */
export function NewProviderFab({ slug }: { slug: string }) {
  const path = usePathname();
  if (path.startsWith(`/c/${slug}/admin`)) return null;
  return (
    <Link href={`/c/${slug}/novo`} className="btn fixed bottom-5 left-1/2 z-10 -translate-x-1/2 shadow-lg">
      ＋ Indicar um profissional
    </Link>
  );
}
