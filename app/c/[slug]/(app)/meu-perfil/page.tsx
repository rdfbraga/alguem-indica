import Link from "next/link";
import { getScope, requireMember } from "@/lib/condo";
import type { ProviderRow } from "@/lib/types";
import type { ProviderStats } from "@/lib/stats";
import { providerCategoryLabels } from "@/lib/categories";
import { providerSpecialtyLabels } from "@/lib/specialties";
import { shareProfileLink, shareProfileText } from "@/lib/origin";
import { Stars } from "@/components/Stars";
import { SITE_URL } from "@/lib/site";

export const metadata = { title: "Meu perfil" };

/** O que falta para o perfil convencer: foto e uma boa descrição são o que mais gera contato. */
function todo(p: ProviderRow): string[] {
  const out: string[] = [];
  if (!p.photo_url) out.push("Adicione uma foto");
  if ((p.description ?? "").trim().length < 40) out.push("Escreva uma descrição (o que você faz, horários, diferenciais)");
  if (!p.instagram && !p.website) out.push("Inclua seu Instagram ou site (opcional)");
  return out;
}

export default async function MeuPerfil({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { condo, user, member, supabase } = await requireMember(slug);
  const scope = await getScope(condo.id);
  const isProvider = member.role === "provider";

  // Meus perfis: onde sou dona, ou cadastrei o meu e aguardo a confirmação.
  const { data } = await supabase
    .from("provider_listing").select("*").in("condo_id", scope).eq("status", "active")
    .or(`owner_id.eq.${user.id},and(created_by.eq.${user.id},self_pending.eq.true)`)
    .order("created_at");
  const profiles = (data ?? []) as ProviderRow[];

  // Pedidos para assumir ainda em análise (que ainda não viraram perfil seu)
  const { data: claimRows } = await supabase.from("profile_claims").select("provider_id").eq("user_id", user.id).eq("status", "pending");
  const claimIds = ((claimRows ?? []) as { provider_id: string }[]).map((c) => c.provider_id).filter((id) => !profiles.some((p) => p.id === id));
  const { data: claimProv } = claimIds.length ? await supabase.from("providers").select("id,name").in("id", claimIds) : { data: [] };
  const waiting = (claimProv ?? []) as { id: string; name: string }[];

  const stats = await Promise.all(
    profiles.map(async (p) => {
      if (p.owner_id !== user.id) return null;   // os números são de quem é dona do perfil
      const { data: s } = await supabase.rpc("provider_stats", { p_provider: p.id, p_days: 7 });
      return (s ?? null) as ProviderStats | null;
    }),
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold">🧰 Meu perfil</h1>
        <p className="muted">Veja como o seu perfil está indo e edite quando quiser.</p>
      </header>

      {profiles.map((p, i) => {
        const s = stats[i];
        const confirmed = p.owner_id === user.id;
        const hints = todo(p);
        const shareHref = shareProfileLink(shareProfileText({ categories: providerCategoryLabels(p), url: `${SITE_URL}/c/${slug}/p/${p.id}` }));
        return (
          <article key={p.id} className="card space-y-3">
            <div className="flex items-center gap-3">
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-brand-100" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-50 text-3xl ring-2 ring-brand-100">{p.category_icon}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-extrabold">{p.name}</div>
                <div className="truncate text-sm text-navy/60">{providerCategoryLabels(p).join(" · ")}</div>
                {providerSpecialtyLabels(p).length > 0 && <div className="truncate text-xs font-semibold text-brand-700">{providerSpecialtyLabels(p).join(" · ")}</div>}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${confirmed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
                  {confirmed ? "✅ Perfil confirmado" : "⏳ Aguardando confirmação da administração"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-sky-soft p-2">
                <div className="text-xl font-extrabold">{s ? s.totals.viewers : "—"}</div>
                <div className="text-[11px] text-navy/60">pessoas viram (7 dias)</div>
              </div>
              <div className="rounded-xl bg-sky-soft p-2">
                <div className="text-xl font-extrabold">{s ? s.totals.whatsapp : "—"}</div>
                <div className="text-[11px] text-navy/60">cliques no WhatsApp</div>
              </div>
              <div className="rounded-xl bg-sky-soft p-2">
                <div className="text-xl font-extrabold">{p.review_count}</div>
                <div className="text-[11px] text-navy/60">{p.review_count > 0 ? <span className="inline-flex items-center gap-0.5">avaliações <Stars value={p.avg_rating} size="text-[10px]" /></span> : "avaliações"}</div>
              </div>
            </div>
            {!confirmed && <p className="text-xs text-navy/60">Os números aparecem depois que a administração confirmar que o perfil é seu.</p>}

            {hints.length > 0 && (
              <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                <b>Para chamar mais clientes:</b>
                <ul className="mt-1 list-disc pl-5">{hints.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Link href={`/c/${slug}/p/${p.id}?editar=1`} className="btn !px-4 !py-2 !text-sm">✏️ Editar perfil</Link>
              <Link href={`/c/${slug}/p/${p.id}`} className="btn-secondary !px-4 !py-2 !text-sm">👁️ Ver como os vizinhos veem</Link>
              <a href={shareHref} target="_blank" rel="noopener noreferrer" className="btn !bg-[#25D366] !px-4 !py-2 !text-sm hover:!bg-[#1ebe57]">📲 Pedir avaliações no WhatsApp</a>
            </div>
            {confirmed && (
              <Link href={`/c/${slug}/resultados?perfil=${p.id}`} className="block text-sm font-bold text-sky-brand underline">Ver resultados completos →</Link>
            )}
          </article>
        );
      })}

      {waiting.map((w) => (
        <div key={w.id} className="card space-y-1 !border-amber-300 !bg-amber-50">
          <div className="font-extrabold">⏳ {w.name}</div>
          <p className="text-sm text-amber-900">Seu pedido para assumir este perfil está em análise. A administração confirma que é você e libera a edição e os números.</p>
        </div>
      ))}

      {profiles.length === 0 && waiting.length === 0 && isProvider && (
        <div className="card space-y-2 text-center">
          <p className="text-3xl">🧰</p>
          <p className="font-bold">Você ainda não assumiu nenhum perfil</p>
          <p className="text-sm text-navy/70">Peça o link para assumir a quem te indicou, ou à administração do condomínio.</p>
        </div>
      )}

      {profiles.length === 0 && waiting.length === 0 && !isProvider && (
        <div className="card space-y-3 text-center">
          <p className="text-3xl">🧰</p>
          <p className="font-bold">Você ainda não tem um perfil aqui</p>
          <p className="text-sm text-navy/70">Presta algum serviço? Cadastre o seu perfil grátis e seja encontrado pelos vizinhos.</p>
          <Link href={`/c/${slug}/novo?eu=1`} className="btn mx-auto !px-4 !py-2 !text-sm">Cadastrar meu serviço</Link>
        </div>
      )}
    </div>
  );
}
