import { requireMember } from "@/lib/condo";
import { KIND_BY_VALUE, STATUS_LABELS } from "@/lib/feedback";
import type { FeedbackRow } from "@/lib/types";
import { FeedbackForm } from "./FeedbackForm";

export const metadata = { title: "Ajuda — Alguém indica?" };

export default async function Ajuda({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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

      <FeedbackForm slug={slug} defaultContact={user.email ?? ""} />

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
