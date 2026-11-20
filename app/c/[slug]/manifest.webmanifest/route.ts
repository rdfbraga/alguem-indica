import { NextResponse } from "next/server";
import { getCondo } from "@/lib/condo";
import { buildManifest } from "@/lib/pwa";

// Manifesto do app instalável deste condomínio (público: não depende de login).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const condo = await getCondo(slug);
  return new NextResponse(JSON.stringify(buildManifest(condo.slug, condo.name)), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
