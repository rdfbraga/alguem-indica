import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFeatures, requireMember } from "@/lib/condo";
import { requestPlanPayment } from "../../../actions";
import { buildPaymentMessage, formatBRL, planAmount, planMonthsLabel } from "@/lib/billing";
import { planState, type PlanRow } from "@/lib/features";
import { whatsappLink } from "@/lib/phone";
import { CopyButton } from "@/components/CopyButton";

export const metadata = { title: "Assinar o plano Destaque" };

type Billing = { price_cents: number; quarter_discount_pct: number; pix_key: string; pix_holder: string; billing_whatsapp: string };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Assinatura do plano Destaque por Pix: o dono escolhe o período, paga e avisa; a administração confirma e libera. */
export default async function Assinar({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { condo, user, supabase } = await requireMember(slug);
  const flags = await getFeatures(condo.id);
  if (!flags.plans) redirect(`/c/${slug}/meu-perfil`);

  const { data: prov } = await supabase.from("providers").select("id,name,owner_id").eq("id", id).maybeSingle();
  if (!prov || prov.owner_id !== user.id) notFound();   // só o dono do perfil assina

  const { data: bi } = await supabase.rpc("billing_info");
  const billing = (bi ?? null) as Billing | null;
  const { data: planRow } = await supabase.from("provider_plans").select("*").eq("provider_id", id).maybeSingle();
  const state = planState((planRow ?? null) as PlanRow | null);
  const { data: pend } = await supabase.rpc("my_pending_payment", { p_provider: id });
  const pending = (Array.isArray(pend) ? pend[0] : null) as { months: number; amount_cents: number } | null;

  const price = billing?.price_cents ?? 2900;
  const disc = billing?.quarter_discount_pct ?? 15;
  const ready = Boolean(billing && billing.pix_key);
  const waLink = pending && billing?.billing_whatsapp
    ? whatsappLink(billing.billing_whatsapp, buildPaymentMessage({ providerName: prov.name, amountCents: pending.amount_cents, months: pending.months, condoName: condo.name }))
    : null;

  return (
    <div className="space-y-5">
      <Link href={`/c/${slug}/meu-perfil`} className="text-sm text-navy/60">← Meu perfil</Link>
      <header>
        <h1 className="text-xl font-extrabold">⭐ Plano Destaque</h1>
        <p className="muted">{prov.name}</p>
        {state.kind === "active" && <p className="mt-1 text-sm font-semibold text-green-700">{state.trial ? "Teste grátis" : "Ativo"} até {fmt(state.endsAt)}. Ao pagar, o novo período começa quando este terminar.</p>}
      </header>

      <section className="card space-y-1 text-sm">
        <p className="font-bold">O que está incluído</p>
        <ul className="list-disc pl-5 text-navy/80">
          <li>Vitrine com serviços e preços, galeria de até 6 fotos e horários</li>
          <li>Respostas públicas às avaliações</li>
          <li>Selo ⭐ Destaque nos resultados</li>
        </ul>
      </section>

      {sp.erro && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Não foi possível registrar o pedido agora. Tente de novo.</p>}

      {!ready ? (
        <p className="card text-sm text-navy/75">
          O pagamento do plano ainda não está disponível por aqui. <Link className="font-bold underline" href={`/c/${slug}/ajuda?tipo=suporte&msg=${encodeURIComponent(`Quero assinar o plano Destaque do perfil "${prov.name}".`)}`}>Fale com a administração</Link> para continuar.
        </p>
      ) : pending ? (
        <section className="card space-y-3">
          <h2 className="font-extrabold">Faça o pagamento por Pix</h2>
          <p className="text-sm text-navy/75">Valor: <b className="text-lg">{formatBRL(pending.amount_cents)}</b> · {planMonthsLabel(pending.months)}</p>
          <div className="rounded-2xl bg-sky-soft p-3 text-sm">
            <div className="text-xs font-semibold text-navy/60">Chave Pix{billing?.pix_holder ? ` · ${billing.pix_holder}` : ""}</div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <code className="break-all font-bold">{billing?.pix_key}</code>
              <CopyButton text={billing!.pix_key} label="Copiar chave" />
            </div>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-navy/80">
            <li>Pague exatamente o valor acima na chave Pix.</li>
            <li>Toque em <b>Já paguei</b> para avisar a administração.</li>
            <li>O plano é liberado assim que o pagamento for confirmado. {state.kind === "active" ? "Seu período atual não se perde." : ""}</li>
          </ol>
          {waLink ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn !bg-[#25D366] w-full hover:!bg-[#1ebe57]">✅ Já paguei: avisar pelo WhatsApp</a>
          ) : (
            <p className="text-sm text-navy/70">Depois de pagar, avise a administração pela página de <Link className="font-bold underline" href={`/c/${slug}/ajuda`}>Ajuda</Link>.</p>
          )}
          <p className="text-xs text-navy/55">Seu pedido está registrado e aguardando a confirmação. Para trocar o período, escolha outro abaixo.</p>
        </section>
      ) : null}

      {ready && (
        <section className="space-y-2">
          <h2 className="font-extrabold">{pending ? "Trocar o período" : "Escolha o período"}</h2>
          {([1, 3] as const).map((m) => (
            <form key={m} action={requestPlanPayment.bind(null, slug, id, m)} className="card flex items-center justify-between gap-3">
              <div>
                <div className="font-extrabold">{planMonthsLabel(m)}</div>
                <div className="text-sm text-navy/70">
                  {formatBRL(planAmount(price, m, disc))}
                  {m === 3 && disc > 0 ? <span className="ml-1 font-semibold text-green-700">· economiza {disc}%</span> : null}
                </div>
              </div>
              <button className={pending && pending.months === m ? "btn-secondary !px-4 !py-2 !text-sm" : "btn !px-4 !py-2 !text-sm"}>
                {pending && pending.months === m ? "Selecionado" : "Escolher"}
              </button>
            </form>
          ))}
        </section>
      )}
    </div>
  );
}
