import { SITE_URL } from "./site.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type MatchRecipient = { email: string; label: string; condo_slug: string; category_slug: string | null; provider_name: string };

/** Link para ver a indicação: a categoria, quando o pedido tinha uma; senão, a busca pelo que a pessoa pediu. */
export function requestEmailLink(r: Pick<MatchRecipient, "condo_slug" | "category_slug" | "label">, base: string = SITE_URL): string {
  return r.category_slug
    ? `${base}/c/${r.condo_slug}/categoria/${r.category_slug}`
    : `${base}/c/${r.condo_slug}?q=${encodeURIComponent(r.label)}`;
}

/** Texto do aviso. Não leva telefone nem dados de ninguém: só o nome do profissional e o link do app. */
export function buildRequestEmail(r: MatchRecipient, base: string = SITE_URL): { subject: string; text: string; html: string } {
  const link = requestEmailLink(r, base);
  const subject = `Alguém indicou o que você procurava: ${r.label}`;
  const text =
    `Oi! Você pediu aos vizinhos uma indicação de “${r.label}” no Alguém indica?.\n\n` +
    `Boa notícia: ${r.provider_name} acabou de ser indicado(a). Veja o perfil, as avaliações e chame direto no WhatsApp:\n${link}\n\n` +
    `Você recebe este aviso uma única vez por pedido. Para não receber avisos como este, abra o app e toque em “Não preciso mais” no seu pedido.`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1c2b3a">` +
    `<h2 style="color:#F55A00;margin:0 0 12px">🎉 Alguém indicou o que você procurava</h2>` +
    `<p>Você pediu aos vizinhos uma indicação de <b>${esc(r.label)}</b>.</p>` +
    `<p><b>${esc(r.provider_name)}</b> acabou de ser indicado(a). Veja o perfil, as avaliações e chame direto no WhatsApp.</p>` +
    `<p><a href="${esc(link)}" style="display:inline-block;background:#F55A00;color:#fff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:12px">Ver a indicação</a></p>` +
    `<p style="font-size:12px;color:#666">Você recebe este aviso uma única vez por pedido. Para não receber avisos como este, abra o app e toque em “Não preciso mais” no seu pedido.</p>` +
    `</div>`;
  return { subject, text, html };
}
