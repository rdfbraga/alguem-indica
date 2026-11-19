"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCondo, getUser, requireAdmin, requireMember } from "@/lib/condo";
import { normalizeWhatsapp } from "@/lib/phone";
import { normalizeInstagram, normalizeWebsite } from "@/lib/links";
import type { FormState } from "@/lib/types";
import { parseFeedbackKind, validateMessage } from "@/lib/feedback";
import { MAX_CATEGORIES, parseCategoryIds } from "@/lib/categories";

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

/** Valida categorias (1 a 3) e o texto de "Outros". Devolve os ids na ordem (a primeira é a principal). */
async function readCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fd: FormData,
): Promise<{ ok: true; ids: number[]; custom: string; hasOther: boolean } | { ok: false; error: string }> {
  const ids = parseCategoryIds(fd.getAll("category_id"));
  if (ids.length < 1) return { ok: false, error: "Escolha uma categoria." };
  if (ids.length > MAX_CATEGORIES) return { ok: false, error: `Escolha no máximo ${MAX_CATEGORIES} categorias.` };
  const { data: cats } = await supabase.from("categories").select("id,slug").in("id", ids);
  if (!cats || cats.length !== ids.length) return { ok: false, error: "Categoria inválida." };
  const hasOther = cats.some((c) => c.slug === "outros");
  const custom = str(fd, "custom_category").replace(/\s+/g, " ");
  if (hasOther && (custom.length < 2 || custom.length > 40)) {
    return { ok: false, error: "Diga qual é o serviço em “Outros” (de 2 a 40 letras). Ex.: Dedetização." };
  }
  return { ok: true, ids, custom: hasOther ? custom : "", hasOther };
}

export async function createProvider(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, user, member, supabase } = await requireMember(slug);
  const name = str(fd, "name");
  const description = str(fd, "description");
  const kind = str(fd, "kind");
  const photo_url = str(fd, "photo_url") || null;
  const whatsapp = normalizeWhatsapp(str(fd, "whatsapp"));
  if (name.length < 2) return { error: "Informe o nome do prestador." };
  if (kind !== "resident" && kind !== "external") return { error: "Informe se é morador ou externo." };
  if (!whatsapp) return { error: "WhatsApp inválido. Use o formato (11) 99999-8888." };
  if (description.length > 500) return { error: "A descrição deve ter até 500 caracteres." };
  if (photo_url && !photo_url.includes("/provider-photos/")) return { error: "Foto inválida." };
  const ig = normalizeInstagram(str(fd, "instagram"));
  if (!ig.ok) return { error: "Instagram inválido. Use o @ do perfil ou o link, ex.: @nomedaloja." };
  const site = normalizeWebsite(str(fd, "website"));
  if (!site.ok) return { error: "Site inválido. Use um endereço como www.seusite.com.br." };
  const cats = await readCategories(supabase, fd);
  if (!cats.ok) return { error: cats.error };

  const block = kind === "resident" ? str(fd, "block") || member.block : null;
  const { data, error } = await supabase
    .from("providers")
    .insert({
      condo_id: condo.id, category_id: cats.ids[0], created_by: user.id, name, description, whatsapp, photo_url, kind, block,
      ...(cats.hasOther ? { custom_category: cats.custom } : {}),
      ...(ig.value ? { instagram: ig.value } : {}),
      ...(site.value ? { website: site.value } : {}),
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      // Mesmo WhatsApp: leva ao perfil existente; se a categoria pedida ainda não está lá, oferece incluí-la.
      const { data: existing } = await supabase
        .from("providers").select("id, category_id").eq("condo_id", condo.id).eq("whatsapp", whatsapp).maybeSingle();
      if (existing) {
        const { data: have } = await supabase.from("provider_categories").select("category_id").eq("provider_id", existing.id);
        const haveIds = new Set([existing.category_id, ...((have ?? []).map((h) => h.category_id as number))]);
        const missing = cats.ids.filter((id) => !haveIds.has(id));
        redirect(`/c/${slug}/p/${existing.id}?jaexiste=1${missing.length ? `&addcat=${missing.join(",")}` : ""}`);
      }
      return { error: "Este WhatsApp já está cadastrado (possivelmente oculto)." };
    }
    return { error: "Não foi possível salvar. Tente de novo." };
  }
  if (fd.get("is_me") === "on") {
    // O autor diz que o perfil é dele: abre um pedido para o admin confirmar (ele já pode editar enquanto isso).
    const { error: claimError } = await supabase.rpc("request_profile_claim", { p_provider: data.id, p_note: "Cadastrou o próprio perfil" });
    if (claimError) console.error("request_profile_claim", claimError);
  }
  if (cats.ids.length > 1 || cats.hasOther) {
    const { error: rpcError } = await supabase.rpc("set_provider_categories", {
      p_provider: data.id, p_category_ids: cats.ids, p_custom: cats.custom || null,
    });
    if (rpcError) console.error("set_provider_categories", rpcError); // o perfil já existe com a categoria principal
  }
  revalidatePath(`/c/${slug}`, "layout");
  redirect(`/c/${slug}/p/${data.id}?novo=1`);
}

/** Troca as categorias de um perfil (autor ou admin). Devolve texto de erro em português ou null. */
async function saveCategories(slug: string, providerId: string, fd: FormData): Promise<string | null> {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(providerId)) return "Perfil inválido.";
  const cats = await readCategories(supabase, fd);
  if (!cats.ok) return cats.error;
  const { error } = await supabase.rpc("set_provider_categories", {
    p_provider: providerId, p_category_ids: cats.ids, p_custom: cats.custom || null,
  });
  if (error) {
    if (error.message?.includes("sem permiss")) return "Só quem indicou este profissional ou a administração pode editar as categorias.";
    if (error.message?.includes("custom_required")) return "Diga qual é o serviço em “Outros”.";
    console.error("saveCategories", error);
    return "Não foi possível salvar as categorias.";
  }
  revalidatePath(`/c/${slug}`, "layout");
  return null;
}

export async function updateProviderCategories(slug: string, providerId: string, _: FormState, fd: FormData): Promise<FormState> {
  const error = await saveCategories(slug, providerId, fd);
  return error ? { error } : { ok: "Categorias atualizadas!" };
}

/** Usado pelo aviso "já cadastrado": inclui a categoria pedida e volta ao perfil. */
export async function addCategoriesAndReturn(slug: string, providerId: string, fd: FormData) {
  const error = await saveCategories(slug, providerId, fd);
  redirect(`/c/${slug}/p/${providerId}${error ? `?catsErro=1` : "?catsOk=1"}`);
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
    p_group_id: Number(fd.get("group_id")),
    p_provider_ids: ids,
  });
  revalidatePath(`/c/${slug}`, "layout");
}

export async function adminMoveToCategory(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFrom(fd);
  const category_id = Number(fd.get("category_id"));
  if (!ids.length || !Number.isInteger(category_id) || category_id <= 0) return;
  await supabase.rpc("replace_other_category", { p_condo: condo.id, p_provider_ids: ids, p_category_id: category_id });
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

// ─── Contato com a administração ───
export async function submitFeedback(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, user, supabase } = await requireMember(slug);
  const kind = parseFeedbackKind(str(fd, "kind"));
  if (!kind) return { error: "Escolha o tipo da mensagem." };
  const msg = validateMessage(String(fd.get("message") ?? ""));
  if (!msg.ok) return { error: msg.error };
  const reply_to = str(fd, "reply_to").slice(0, 120) || null;

  const { error } = await supabase
    .from("feedback")
    .insert({ condo_id: condo.id, user_id: user.id, kind, message: msg.text, reply_to });
  if (error) {
    if (error.message?.includes("rate_limit")) {
      return { error: "Você já enviou 5 mensagens hoje. Tente de novo amanhã." };
    }
    console.error("submitFeedback", error);
    return { error: "Não foi possível enviar agora. Tente de novo em instantes." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Mensagem enviada! A resposta aparece aqui mesmo, nesta página." };
}

export async function adminReplyFeedback(slug: string, id: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const msg = validateMessage(String(fd.get("reply") ?? ""));
  if (!msg.ok || !UUID.test(id)) return;
  await supabase
    .from("feedback")
    .update({ admin_reply: msg.text, status: "answered", replied_at: new Date().toISOString() })
    .eq("id", id)
    .eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}

export async function adminSetFeedbackStatus(slug: string, id: string, status: "new" | "archived") {
  const { condo, supabase } = await requireAdmin(slug);
  if (!UUID.test(id)) return;
  await supabase.from("feedback").update({ status }).eq("id", id).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}

// ─── Posse de perfil ───
const CLAIM_ERRORS: [string, string][] = [
  ["already_pending", "Você já tem um pedido em análise para este perfil."],
  ["already_owner", "Você já é o dono deste perfil."],
  ["already_owned", "Este perfil já tem dono. Se houver algo errado, fale com a administração."],
  ["too_many", "Você já tem 3 pedidos em análise. Aguarde a resposta da administração."],
];

export async function requestProfileClaim(slug: string, providerId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(providerId)) return { error: "Perfil inválido." };
  const note = str(fd, "note").slice(0, 300);
  const { error } = await supabase.rpc("request_profile_claim", { p_provider: providerId, p_note: note || null });
  if (error) {
    const known = CLAIM_ERRORS.find(([k]) => error.message?.includes(k));
    if (known) return { error: known[1] };
    console.error("requestProfileClaim", error);
    return { error: "Não foi possível enviar o pedido agora." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Pedido enviado! A administração vai confirmar e você será o dono do perfil." };
}

export async function updateProviderProfile(slug: string, providerId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(providerId)) return { error: "Perfil inválido." };
  const name = str(fd, "name");
  const description = str(fd, "description");
  const whatsapp = normalizeWhatsapp(str(fd, "whatsapp"));
  const photo_url = str(fd, "photo_url");
  if (name.length < 2 || name.length > 80) return { error: "O nome deve ter de 2 a 80 caracteres." };
  if (!whatsapp) return { error: "WhatsApp inválido. Use o formato (11) 99999-8888." };
  if (description.length > 500) return { error: "A descrição deve ter até 500 caracteres." };
  const ig = normalizeInstagram(str(fd, "instagram"));
  if (!ig.ok) return { error: "Instagram inválido. Use o @ do perfil ou o link, ex.: @nomedaloja." };
  const site = normalizeWebsite(str(fd, "website"));
  if (!site.ok) return { error: "Site inválido. Use um endereço como www.seusite.com.br." };
  const { error } = await supabase.rpc("update_provider_profile", {
    p_provider: providerId, p_name: name, p_description: description, p_whatsapp: whatsapp, p_photo_url: photo_url || null,
    p_instagram: ig.value, p_website: site.value,
  });
  if (error) {
    if (error.code === "23505") return { error: "Este WhatsApp já está cadastrado em outro perfil." };
    if (error.message?.includes("sem permiss")) return { error: "Só o dono do perfil (ou a administração) pode editar." };
    console.error("updateProviderProfile", error);
    return { error: "Não foi possível salvar." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Perfil atualizado!" };
}

export async function adminDecideClaim(slug: string, claimId: string, approve: boolean) {
  const { supabase } = await requireAdmin(slug);
  if (!UUID.test(claimId)) return;
  await supabase.rpc("decide_profile_claim", { p_claim: claimId, p_approve: approve });
  revalidatePath(`/c/${slug}`, "layout");
}

export async function adminClearOwner(slug: string, providerId: string) {
  const { supabase } = await requireAdmin(slug);
  if (!UUID.test(providerId)) return;
  await supabase.rpc("clear_provider_owner", { p_provider: providerId });
  revalidatePath(`/c/${slug}`, "layout");
}
