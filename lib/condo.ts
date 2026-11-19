import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Condo, Member } from "@/lib/types";

export const getCondo = cache(async (slug: string): Promise<Condo> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("condo_by_slug", { s: slug });
  const condo = (data as Condo[] | null)?.[0];
  if (!condo) notFound();
  return condo;
});

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Exige login e cadastro de morador neste condomínio. */
export async function requireMember(slug: string) {
  const condo = await getCondo(slug);
  const user = await getUser();
  if (!user) redirect(`/c/${slug}/entrar`);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("condo_id", condo.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) redirect(`/c/${slug}/cadastro`);
  return { condo, user, member: member as Member, supabase };
}

export async function requireAdmin(slug: string) {
  const ctx = await requireMember(slug);
  if (ctx.member.role !== "admin") redirect(`/c/${slug}`);
  return ctx;
}

/** Garante que `next` seja um caminho interno (evita open redirect). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) return next;
  return fallback;
}
