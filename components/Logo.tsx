import Link from "next/link";

/** Ícone + nome, no estilo do logo. `size="lg"` inclui o slogan (telas de entrada). */
export function Logo({ href, size = "sm" }: { href?: string; size?: "sm" | "lg" }) {
  const content =
    size === "lg" ? (
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="" className="h-32 w-auto" />
        <div className="mt-2 text-4xl font-extrabold leading-none tracking-tight">
          <span className="text-brand-500">Alguém</span> <span className="text-navy">indica?</span>
        </div>
        <div className="mt-2 text-sm font-semibold text-navy/70">A rede de confiança do seu condomínio</div>
      </div>
    ) : (
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="" className="h-9 w-auto" />
        <span className="text-xl font-extrabold leading-none tracking-tight">
          <span className="text-brand-500">Alguém</span> <span className="text-navy">indica?</span>
        </span>
      </div>
    );
  return href ? <Link href={href} aria-label="Alguém indica? — início">{content}</Link> : content;
}
