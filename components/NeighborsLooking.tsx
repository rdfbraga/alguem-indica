import Link from "next/link";
import { ackRequestUpdate, cancelIndicationRequest, requestWithNotify, setRequestNotify } from "@/app/c/[slug]/actions";
import { RequestForm } from "./RequestForm";

export type OpenRequest = { group_key: string; label: string; category_slug: string | null; n: number; i_asked: boolean; i_notify?: boolean; i_searched?: boolean };
export type RequestUpdate = { id: string; label: string; category_slug: string | null };

const TOP = 4;

/** Home: "🎉 agora tem indicação" (para quem pediu) e "🔎 Os vizinhos estão procurando" (pedidos sem prestador, da região). */
export function NeighborsLooking({ slug, requests, updates }: { slug: string; requests: OpenRequest[]; updates: RequestUpdate[] }) {
  const href = (r: { label: string; category_slug: string | null }) =>
    `/c/${slug}/novo?servico=${encodeURIComponent(r.label)}${r.category_slug ? `&cat=${encodeURIComponent(r.category_slug)}` : ""}`;
  const shown = requests.slice(0, TOP);
  const more = requests.slice(TOP);
  const item = (r: OpenRequest) => (
    <div key={r.group_key} className="card flex items-center justify-between gap-3 !p-3">
      <div className="min-w-0">
        <div className="truncate font-extrabold">{r.label}</div>
        <div className="text-xs text-navy/60">
          {r.n} {r.n === 1 ? "vizinho procura" : "vizinhos procuram"}{r.i_asked || r.i_searched ? " · inclusive você" : ""}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Link href={href(r)} className="btn !px-3 !py-1.5 !text-xs">Eu conheço alguém</Link>
        {!r.i_asked && r.i_searched && (
          <form action={requestWithNotify.bind(null, slug, r.label)}>
            <button className="text-[11px] font-semibold text-sky-brand underline">🔔 Avisar por e-mail</button>
          </form>
        )}
        {r.i_asked && (
          <>
            <form action={setRequestNotify.bind(null, slug, r.label, !r.i_notify)}>
              <button className="text-[11px] font-semibold text-sky-brand underline">{r.i_notify ? "🔔 Aviso por e-mail ligado · desligar" : "🔕 Avisar por e-mail"}</button>
            </form>
            <form action={cancelIndicationRequest.bind(null, slug, r.label)}>
              <button className="text-[11px] font-semibold text-navy/55 underline">Não preciso mais</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
  return (
    <>
      {updates.map((u) => (
        <div key={u.id} className="card flex items-center justify-between gap-3 !border-green-300 !bg-green-50">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-green-800">🎉 Agora tem indicação!</div>
            <div className="truncate font-extrabold">{u.label}</div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href={u.category_slug ? `/c/${slug}/categoria/${u.category_slug}` : `/c/${slug}?q=${encodeURIComponent(u.label)}`}
              className="btn !px-3 !py-1.5 !text-xs"
            >Ver</Link>
            <form action={ackRequestUpdate.bind(null, slug, u.id)}>
              <button className="text-xs font-semibold text-navy/55 underline">Fechar</button>
            </form>
          </div>
        </div>
      ))}
      <section className="space-y-2" aria-label="Os vizinhos estão procurando">
        <h2 className="text-lg font-extrabold">🔎 Os vizinhos estão procurando</h2>
        <p className="text-sm text-navy/70">Ainda não há ninguém indicado para isso. Se você conhece, indique e ajude.</p>
        {shown.map(item)}
        {more.length > 0 && (
          <details className="space-y-2">
            <summary className="cursor-pointer text-sm font-bold text-sky-brand">Ver mais {more.length}</summary>
            <div className="mt-2 space-y-2">{more.map(item)}</div>
          </details>
        )}
        {requests.length === 0 && <p className="text-sm text-navy/60">Nenhum pedido em aberto agora.</p>}
        <details className="card !p-3">
          <summary className="cursor-pointer text-sm font-bold text-sky-brand">＋ Procuro um profissional que não está no app</summary>
          <div className="mt-3"><RequestForm slug={slug} cta="Pedir indicação" /></div>
        </details>
      </section>
    </>
  );
}
