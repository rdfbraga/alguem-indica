import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Condo, Member } from "@/lib/types";
import { parseFlags, type Flags } from "@/lib/features";
import { withNext } from "@/lib/next-path";

export const getCondo = cache(async (slug: string): Promise<Condo> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("condo_by_slug", { s: slug });
  if (error) {
    // Erro de configuração/permissão: não esconder atrás de um 404.
    throw new Error(`Falha ao consultar o condomínio (${error.code ?? "?"}): ${error.message}`);
  }
  const condo = (data as Condo[] | null)?.[0];
  if (!condo) notFound();
  return condo;
});

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Exige login e cadastro de morador neste condomínio. `nextPath` (opcional) é para onde voltar depois de entrar. */
export async function requireMember(slug: string, nextPath?: string) {
  const condo = await getCondo(slug);
  // Sem destino explícito, volta para a página que a pessoa tentou abrir (valor posto pelo proxy; validado em withNext).
  nextPath ??= (await headers()).get("x-next-path") ?? undefined;
  const user = await getUser();
  if (!user) redirect(withNext(`/c/${slug}/entrar`, slug, nextPath));
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("condo_id", condo.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) redirect(withNext(`/c/${slug}/cadastro`, slug, nextPath));
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

/** Chaves de funcionalidades do condomínio (tudo desligado se a tabela ainda não existir). */
export const getFeatures = cache(async (condoId: string): Promise<Flags> => {
  const supabase = await createClient();
  const { data } = await supabase.from("condo_features").select("feature,enabled").eq("condo_id", condoId);
  return parseFlags(data);
});
