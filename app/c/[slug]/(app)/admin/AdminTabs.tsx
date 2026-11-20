"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: string; badge?: number; match: (p: string) => boolean };

export function AdminTabs({ slug, pending, multi = false, otherPending = 0 }: { slug: string; pending: number; multi?: boolean; otherPending?: number }) {
  const path = usePathname();
  const base = `/c/${slug}/admin`;
  const tabs: Tab[] = [
    { href: base, label: "Moderar", icon: "🛡️", badge: pending, match: (p) => p === base },
    { href: `${base}/perfis`, label: "Perfis", icon: "👥", match: (p) => p.startsWith(`${base}/perfis`) },
    { href: `${base}/monitorar`, label: "Monitorar", icon: "📈", match: (p) => p.startsWith(`${base}/monitorar`) },
    { href: `${base}/configurar`, label: "Configurar", icon: "⚙️", match: (p) => p.startsWith(`${base}/configurar`) || p.startsWith(`${base}/categorias`) || p.startsWith(`${base}/especialidades`) },
  ];
  if (multi) tabs.push({ href: `${base}/condominios`, label: "Condomínios", icon: "🏘️", badge: otherPending, match: (p) => p.startsWith(`${base}/condominios`) });
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-sky-soft p-1" aria-label="Seções do painel">
      {tabs.map((t) => {
        const on = t.match(path);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition ${on ? "bg-white text-navy shadow-sm" : "text-navy/60 hover:text-navy"}`}
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
