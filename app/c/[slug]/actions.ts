"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCondo, getUser, requireAdmin, requireMember } from "@/lib/condo";
import { normalizeWhatsapp } from "@/lib/phone";
import type { FormState } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function completeOnboarding(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const condo = await getCondo(slug);
  const user = await getUser();
  if (!user) redirect(`/c/${slug}/entrar`);
  const full_name = str(fd, "full_name");
  const block = str(fd, "block");
  const unit = str(fd, "unit");
  if (full_name.length < 2) return { error: "Informe seu nome completo." };
  if (!block || !unit) return { error: "Informe bloco/torre e unidade." };
  if (fd.get("terms") !== "on") return { error: "É preciso aceitar os termos para continuar." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .insert({ user_id: user.id, condo_id: condo.id, full_name, block, unit });
  // 23505 = já era morador (ex.: clique duplo): segue normalmente.
  if (error && error.code !== "23505") {
    console.error("completeOnboarding", error);
    return { error: `Não foi possível concluir o cadastro (${error.code ?? "erro"}: ${error.message}).` };
  }
  redirect(`/c/${slug}`);
}

export async function createProvider(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, user, member, supabase } = await requireMember(slug);
  const name = str(fd, "name");
  const description = str(fd, "description");
  const category_id = Number(fd.get("category_id"));
  const kind = str(fd, "kind");
  const photo_url = str(fd, "photo_url") || null;
  const custom = str(fd, "custom_category").replace(/\s+/g, " ");
  const whatsapp = normalizeWhatsapp(str(fd, "whatsapp"));
  if (name.length < 2) return { error: "Informe o nome do prestador." };
  if (!Number.isInteger(category_id) || category_id <= 0) return { error: "Escolha uma categoria." };
  if (kind !== "resident" && kind !== "external") return { error: "Informe se é morador ou externo." };
  if (!whatsapp) return { error: "WhatsApp inválido. Use o formato (11) 99999-8888." };
  if (description.length > 500) return { error: "A descrição deve ter até 500 caracteres." };
  if (photo_url && !photo_url.includes("/provider-photos/")) return { error: "Foto inválida." };

  const { data: cat } = await supabase.from("categories").select("slug").eq("id", category_id).maybeSingle();
  if (!cat) return { error: "Categoria inválida." };
  const isOther = cat.slug === "outros";
  if (isOther && (custom.length < 2 || custom.length > 40)) {
    return { error: "Diga qual é a categoria (de 2 a 40 letras). Ex.: Dedetização." };
  }
  const custom_category = isOther ? custom : null;

  const block = kind === "resident" ? str(fd, "block") || member.block : null;
  const { data, error } = await supabase
    .from("providers")
    .insert({ condo_id: condo.id, category_id, created_by: user.id, name, description, whatsapp, photo_url, kind, block, ...(custom_category ? { custom_category } : {}) })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("providers")
        .select("id, name")
        .eq("condo_id", condo.id)
        .eq("whatsapp", whatsapp)
        .maybeSingle();
      if (existing) redirect(`/c/${slug}/p/${existing.id}?jaexiste=1`);
      return { error: "Este WhatsApp já está cadastrado (possivelmente oculto)." };
    }
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  redirect(`/c/${slug}/p/${data.id}?novo=1`);
}

export async function submitReview(slug: string, providerId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, user, supabase } = await requireMember(slug);
  const rating = Number(fd.get("rating"));
  const comment = str(fd, "comment");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Escolha uma nota de 1 a 5." };
  if (comment.length > 600) return { error: "O comentário deve ter até 600 caracteres." };
  const { error } = await supabase
    .from("reviews")
    .insert({ condo_id: condo.id, provider_id: providerId, author_id: user.id, rating, comment, author_label: "" });
  if (error) {
    if (error.code === "23505") return { error: "Você já avaliou este prestador." };
    return { error: "Não foi possível enviar sua avaliação." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Obrigado pela avaliação!" };
}

export async function reportItem(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, user, supabase } = await requireMember(slug);
  const target = str(fd, "target");
  const id = str(fd, "id");
  const reason = str(fd, "reason");
  if (reason.length < 3) return { error: "Descreva brevemente o problema." };
  if (target !== "provider" && target !== "review") return { error: "Alvo inválido." };
  const { error } = await supabase.from("reports").insert({
    condo_id: condo.id,
    reporter_id: user.id,
    reason,
    provider_id: target === "provider" ? id : null,
    review_id: target === "review" ? id : null,
  });
  if (error) return { error: "Não foi possível enviar a denúncia." };
  return { ok: "Denúncia enviada. Obrigado!" };
}

export async function signOut(slug: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/c/${slug}/entrar`);
}

// ─── Admin ───
export async function adminSetProviderStatus(slug: string, id: string, status: "active" | "hidden") {
  const { condo, supabase } = await requireAdmin(slug);
  await supabase.from("providers").update({ status }).eq("id", id).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}
export async function adminClearFlag(slug: string, id: string) {
  const { condo, supabase } = await requireAdmin(slug);
  await supabase.from("providers").update({ flagged: false, flag_reason: null }).eq("id", id).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}
export async function adminSetReviewStatus(slug: string, id: string, status: "visible" | "hidden") {
  const { condo, supabase } = await requireAdmin(slug);
  await supabase.from("reviews").update({ status }).eq("id", id).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}
export async function adminResolveReport(slug: string, id: string) {
  const { condo, supabase } = await requireAdmin(slug);
  await supabase.from("reports").update({ status: "resolved" }).eq("id", id).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}

// ─── Sugestões de categoria (admin) ───
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idsFrom = (fd: FormData) =>
  String(fd.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s));

export async function adminCreateCategory(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFrom(fd);
  if (!ids.length) return;
  await supabase.rpc("approve_category", {
    p_condo: condo.id,
    p_name: str(fd, "name"),
    p_icon: str(fd, "icon"),
    p_provider_ids: ids,
  });
  revalidatePath(`/c/${slug}`, "layout");
}

export async function adminMoveToCategory(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFrom(fd);
  const category_id = Number(fd.get("category_id"));
  if (!ids.length || !Number.isInteger(category_id) || category_id <= 0) return;
  await supabase
    .from("providers")
    .update({ category_id, custom_category: null, custom_category_reviewed: false })
    .in("id", ids)
    .eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}

/** Mantém em "Outros": tira da fila, mas o rótulo digitado continua aparecendo no perfil e na busca. */
export async function adminDismissSuggestion(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFrom(fd);
  if (!ids.length) return;
  await supabase.from("providers").update({ custom_category_reviewed: true }).in("id", ids).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}
