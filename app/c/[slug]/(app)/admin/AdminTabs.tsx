"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: string; badge?: number; match: (p: string) => boolean };

export function AdminTabs({ slug, pending, multi = false, otherPending = 0 }: { slug: string; pending: number; multi?: boolean; otherPending?: number }) {
  const path = usePathname();
  const base = `/c/${slug}/admin`;
  const tabs: Tab[] = [
    { href: base, label: "Moderar", icon: "🛡️", badge: pending, match: (p) => p === base },
    { href: `${base}/monitorar`, label: "Monitorar", icon: "📈", match: (p) => p.startsWith(`${base}/monitorar`) },
    { href: `${base}/configurar`, label: "Configurar", icon: "⚙️", match: (p) => p.startsWith(`${base}/configurar`) || p.startsWith(`${base}/categorias`) || p.startsWith(`${base}/especialidades`) },
  ];
  if (multi) tabs.push({ href: `${base}/condominios`, label: "Condomínios", icon: "🏘️", badge: otherPending, match: (p) => p.startsWith(`${base}/condominios`) });
  return (
    <nav className={`grid ${multi ? "grid-cols-4" : "grid-cols-3"} gap-1 rounded-2xl bg-sky-soft p-1`} aria-label="Seções do painel">
      {tabs.map((t) => {
        const on = t.match(path);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-wrap items-center justify-center gap-x-1 rounded-xl px-1 py-2 text-xs font-bold transition sm:text-sm ${on ? "bg-white text-navy shadow-sm" : "text-navy/60 hover:text-navy"}`}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
            {(t.badge ?? 0) > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-xs text-white">{t.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
