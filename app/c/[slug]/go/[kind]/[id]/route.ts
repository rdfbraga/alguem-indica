import { NextResponse, type NextRequest } from "next/server";
import { getCondo, getFeatures, getUser } from "@/lib/condo";
import { createClient } from "@/lib/supabase/server";
import { whatsappLink } from "@/lib/phone";
import { instagramUrl } from "@/lib/links";
import { buildContactMessage, hourInSaoPaulo } from "@/lib/contact";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const KINDS = ["whatsapp", "instagram", "website", "ad"] as const;
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

  if (kind === "ad") {
    // Anúncio: só se a chave estiver ligada e o anúncio vigente (o banco aplica isso via RLS e na função de registro).
    const { data: ad } = await supabase.from("ads").select("advertiser,link_url,whatsapp,active").eq("id", id).eq("condo_id", condo.id).maybeSingle();
    if (!ad || !ad.active || !(await getFeatures(condo.id)).ads) return back(`/c/${slug}`);
    const adTarget = ad.link_url && /^https?:\/\//i.test(ad.link_url)
      ? ad.link_url
      : ad.whatsapp ? whatsappLink(ad.whatsapp, `Olá! Vi o anúncio de ${ad.advertiser} no Alguém indica? (${condo.name}).`) : null;
    if (!adTarget) return back(`/c/${slug}`);
    await supabase.rpc("log_ad_event", { p_ad: id, p_kind: "click" });
    const adRes = NextResponse.redirect(adTarget, 302);
    adRes.headers.set("Cache-Control", "no-store");
    adRes.headers.set("Referrer-Policy", "no-referrer");
    return adRes;
  }

  const { data: p } = await supabase
    .from("provider_listing").select("name,whatsapp,instagram,website,category_slug").eq("id", id).eq("condo_id", condo.id).maybeSingle();
  if (!p) return back(`/c/${slug}`);

  let target: string | null = null;
  if (kind === "whatsapp") {
    const { data: me } = await supabase.from("members").select("full_name").eq("condo_id", condo.id).eq("user_id", user.id).maybeSingle();
    target = whatsappLink(
      p.whatsapp,
      buildContactMessage({ providerName: p.name, residentName: me?.full_name, condoName: condo.name, categorySlug: p.category_slug, hour: hourInSaoPaulo(), profileUrl: `${SITE_URL}/c/${slug}/p/${id}` }),
    );
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
