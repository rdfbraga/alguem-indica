import { NextResponse, type NextRequest } from "next/server";
import { getCondo, getUser } from "@/lib/condo";
import { createClient } from "@/lib/supabase/server";
import { whatsappLink } from "@/lib/phone";
import { instagramUrl } from "@/lib/links";

export const dynamic = "force-dynamic";

const KINDS = ["whatsapp", "instagram", "website"] as const;
type Kind = (typeof KINDS)[number];

// Registra o clique e leva ao destino (WhatsApp, Instagram ou site do prestador).
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string; kind: string; id: string }> }) {
  const { slug, kind, id } = await params;
  const origin = new URL(request.url).origin;
  const back = (path: string) => NextResponse.redirect(`${origin}${path}`, 302);

  const condo = await getCondo(slug);
  const user = await getUser();
  if (!user) return back(`/c/${slug}/entrar`);
  if (!KINDS.includes(kind as Kind) || !/^[0-9a-f-]{36}$/i.test(id)) return back(`/c/${slug}`);

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("provider_listing").select("name,whatsapp,instagram,website").eq("id", id).eq("condo_id", condo.id).maybeSingle();
  if (!p) return back(`/c/${slug}`);

  let target: string | null = null;
  if (kind === "whatsapp") {
    target = whatsappLink(p.whatsapp, `Olá, ${p.name}! Vi seu perfil no Alguém indica? (${condo.name}). Pode me ajudar?`);
  } else if (kind === "instagram" && p.instagram) {
    target = instagramUrl(p.instagram);
  } else if (kind === "website" && p.website && /^https?:\/\//i.test(p.website)) {
    target = p.website;
  }
  if (!target) return back(`/c/${slug}/p/${id}`);

  await supabase.rpc("log_provider_event", { p_provider: id, p_kind: kind }); // erros não impedem o redirecionamento
  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
