import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente com a chave de serviço: SÓ no servidor, para tarefas que o morador não pode fazer (ex.: ler e-mails para enviar avisos). */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
