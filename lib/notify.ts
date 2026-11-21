import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRequestEmail, type MatchRecipient } from "@/lib/request-email";

/**
 * Depois que um prestador é indicado, avisa por e-mail quem pediu aquilo ("Os vizinhos estão procurando") e marcou o aviso.
 * Nunca quebra o cadastro: sem as chaves no servidor (RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, MAIL_FROM), não faz nada.
 */
export async function notifyRequestMatches(providerId: string): Promise<void> {
  try {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;
    const admin = createAdminClient();
    if (!key || !from || !admin) return;
    const { data, error } = await admin.rpc("request_match_recipients", { p_provider: providerId });
    if (error || !Array.isArray(data) || data.length === 0) return;
    const done: string[] = [];
    for (const row of data as (MatchRecipient & { request_id: string })[]) {
      const mail = buildRequestEmail(row);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: row.email, subject: mail.subject, text: mail.text, html: mail.html }),
      });
      if (res.ok) done.push(row.request_id);
      else console.error("notifyRequestMatches: Resend", res.status);
    }
    if (done.length) await admin.rpc("mark_requests_emailed", { p_ids: done });
  } catch (e) {
    console.error("notifyRequestMatches", e);
  }
}
