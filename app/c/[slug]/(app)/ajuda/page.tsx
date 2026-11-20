import { requireMember } from "@/lib/condo";
import { KIND_BY_VALUE, STATUS_LABELS, parseFeedbackKind } from "@/lib/feedback";
import type { FeedbackRow } from "@/lib/types";
import { FeedbackForm } from "./FeedbackForm";

export const metadata = { title: "Ajuda — Alguém indica?" };

export default async function Ajuda({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tipo?: string; msg?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { user, supabase, condo } = await requireMember(slug);
  const { data } = await supabase
    .from("feedback")
    .select("*")
    .eq("condo_id", condo.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const mine = (data ?? []) as FeedbackRow[];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold">Fale com a administração 💬</h1>
        <p className="muted">Dúvidas, problemas ou ideias para melhorar o app. A gente responde por aqui.</p>
      </header>

      <details className="card !p-3 text-sm">
        <summary className="cursor-pointer font-bold text-sky-brand">📲 Como instalar o app no celular</summary>
        <div className="mt-3 space-y-3 text-navy/80">
          <p><b>Android (Chrome):</b> toque no menu <b>⋮</b> e em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</p>
          <p><b>iPhone (Safari):</b> toque em <b>Compartilhar</b> (⬆️) e em <b>Adicionar à Tela de Início</b>.</p>
          <p className="text-xs text-navy/60">Abra o link no navegador do celular. Se ele abriu dentro do WhatsApp ou do Instagram, use “Abrir no navegador” antes.</p>
        </div>
      </details>

      <FeedbackForm slug={slug} defaultContact={user.email ?? ""} defaultKind={parseFeedbackKind(sp.tipo) ?? "suporte"} defaultMessage={(sp.msg ?? "").slice(0, 300)} />

      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-extrabold">Suas mensagens</h2>
          {mine.map((f) => (
            <div key={f.id} className="card space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-bold">{KIND_BY_VALUE[f.kind].icon} {KIND_BY_VALUE[f.kind].label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${f.admin_reply ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
                  {f.admin_reply ? "Respondida" : STATUS_LABELS[f.status]}
                </span>
              </div>
              <p className="whitespace-pre-line text-navy/80">{f.message}</p>
              <p className="text-xs text-navy/50">{new Date(f.created_at).toLocaleString("pt-BR")}</p>
              {f.admin_reply && (
                <div className="rounded-2xl bg-sky-soft p-3">
                  <p className="text-xs font-bold text-sky-brand">Resposta da administração</p>
                  <p className="mt-1 whitespace-pre-line text-navy/90">{f.admin_reply}</p>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
