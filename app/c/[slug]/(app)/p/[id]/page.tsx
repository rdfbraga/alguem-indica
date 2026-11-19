import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/condo";
import { formatWhatsapp, whatsappLink } from "@/lib/phone";
import type { ProviderRow, ReviewRow } from "@/lib/types";
import { Stars } from "@/components/Stars";
import { displayCategory } from "@/lib/suggestions";
import { ReportButton } from "@/components/ReportButton";
import { ReviewForm } from "./ReviewForm";

export default async function Prestador({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ novo?: string; jaexiste?: string }>;
}) {
  const { slug, id } = await params;
  const { novo, jaexiste } = await searchParams;
  const { condo, user, member, supabase } = await requireMember(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await supabase.from("provider_listing").select("*").eq("id", id).eq("condo_id", condo.id).maybeSingle();
  if (!data) notFound();
  const p = data as ProviderRow;
  const { data: rs } = await supabase
    .from("reviews").select("*").eq("provider_id", id).eq("status", "visible").order("created_at", { ascending: false });
  const reviews = (rs ?? []) as ReviewRow[];
  const mine = reviews.some((r) => r.author_id === user.id);
  const msg = `Olá, ${p.name}! Vi seu perfil no Alguém Indica (${condo.name}). Pode me ajudar?`;

  return (
    <div className="space-y-4">
      <Link href={`/c/${slug}/categoria/${p.category_slug}`} className="text-sm text-navy/60">← {p.category_name}</Link>
      {novo && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Indicação publicada! Obrigado por ajudar os vizinhos. 🎉</p>}
      {jaexiste && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Este profissional já estava cadastrado. Que tal avaliá-lo?</p>}
      {p.status === "hidden" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Perfil oculto (visível só para administradores).</p>}

      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-4xl">{p.category_icon}</div>
          )}
          <div>
            <h1 className="text-xl font-bold">{p.name}</h1>
            <div className="text-sm text-navy/60">
              {displayCategory(p)} · {p.kind === "resident" ? `Morador${p.block ? ` (Bloco ${p.block})` : ""}` : "Externo indicado por morador"}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {p.review_count > 0 ? (
                <><Stars value={p.avg_rating} /><span className="text-sm text-navy/60">{Number(p.avg_rating).toFixed(1)} ({p.review_count})</span></>
              ) : <span className="text-sm text-navy/45">Sem avaliações ainda</span>}
            </div>
          </div>
        </div>
        {p.description && <p className="whitespace-pre-line text-navy/80">{p.description}</p>}
        <a href={whatsappLink(p.whatsapp, msg)} target="_blank" rel="noopener noreferrer" className="btn w-full !bg-[#25D366] hover:!bg-[#1ebe57]">
          💬 Chamar no WhatsApp · {formatWhatsapp(p.whatsapp)}
        </a>
        <ReportButton slug={slug} target="provider" id={p.id} />
      </div>

      {!mine && <ReviewForm slug={slug} providerId={p.id} />}

      <section className="space-y-3">
        <h2 className="font-semibold">Avaliações dos vizinhos ({reviews.length})</h2>
        {reviews.map((r) => (
          <div key={r.id} className="card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.author_label}</span>
              <Stars value={r.rating} size="text-sm" />
            </div>
            {r.comment && <p className="text-navy/80">{r.comment}</p>}
            <div className="flex items-center justify-between text-xs text-navy/45">
              <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
              {r.author_id !== user.id && <ReportButton slug={slug} target="review" id={r.id} />}
            </div>
          </div>
        ))}
        {reviews.length === 0 && <p className="text-sm text-navy/60">Seja o primeiro vizinho a avaliar.</p>}
      </section>
      {member.role === "admin" && p.flagged && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">⚠️ Sinalizado: {p.flag_reason}</p>
      )}
    </div>
  );
}
