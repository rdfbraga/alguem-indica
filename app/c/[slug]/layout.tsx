import type { Metadata } from "next";
import { getCondo } from "@/lib/condo";

// Liga o manifesto do condomínio (app instalável que abre direto aqui).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const condo = await getCondo(slug);
  return { manifest: `/c/${condo.slug}/manifest.webmanifest` };
}

export default function CondoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
