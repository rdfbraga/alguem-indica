"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCondo, getScope, getUser, requireAdmin, requireMember } from "@/lib/condo";
import { normalizeWhatsapp } from "@/lib/phone";
import { normalizeInstagram, normalizeWebsite } from "@/lib/links";
import type { FormState } from "@/lib/types";
import { parseFeedbackKind, validateMessage } from "@/lib/feedback";
import { MAX_CATEGORIES, parseCategoryIds } from "@/lib/categories";
import { FEATURES } from "@/lib/features";
import { condoNext } from "@/lib/next-path";
import { MAX_SPECIALTIES } from "@/lib/specialties";

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
  // Quem diz que também presta serviço vai direto ao cadastro do próprio perfil.
  redirect(fd.get("offers_service") === "on" ? `/c/${slug}/novo?eu=1` : condoNext(slug, str(fd, "next")));
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

/** Especialidades do formulário (opcional). `present` = o formulário trouxe o seletor (para não apagar as existentes sem querer). */
function readSpecialties(fd: FormData): { present: boolean; ids: number[]; custom: string; error?: string } {
  const present = fd.get("has_specialties") === "1";
  const ids = parseCategoryIds(fd.getAll("specialty_id"));
  const custom = str(fd, "custom_specialty").replace(/\s+/g, " ");
  if (ids.length > MAX_SPECIALTIES) return { present, ids, custom, error: `Escolha no máximo ${MAX_SPECIALTIES} especialidades.` };
  if (custom && (custom.length < 2 || custom.length > 40)) return { present, ids, custom, error: "A especialidade escrita deve ter de 2 a 40 letras." };
  return { present, ids, custom };
}

export async function createProvider(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, user, member, supabase } = await requireMember(slug);
  const name = str(fd, "name");
  const description = str(fd, "description");
  // Cadastro do próprio serviço: só de morador (prestador de fora é indicado por um vizinho e depois assume o perfil).
  const isMe = fd.get("is_me") === "on";
  const kind = isMe ? "resident" : str(fd, "kind");
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
  const specs = readSpecialties(fd);
  if (specs.error) return { error: specs.error };

  const block = isMe ? member.block : kind === "resident" ? str(fd, "block") || member.block : null;
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
        .from("providers").select("id, category_id").in("condo_id", await getScope(condo.id)).eq("whatsapp", whatsapp).maybeSingle();
      if (existing) {
        const { data: have } = await supabase.from("provider_categories").select("category_id").eq("provider_id", existing.id);
        const haveIds = new Set([existing.category_id, ...((have ?? []).map((h) => h.category_id as number))]);
        const missing = cats.ids.filter((id) => !haveIds.has(id));
        redirect(`/c/${slug}/p/${existing.id}?jaexiste=1${isMe ? "&reivindicar=1" : ""}${missing.length ? `&addcat=${missing.join(",")}` : ""}`);
      }
      return { error: "Este WhatsApp já está cadastrado (possivelmente oculto)." };
    }
    return { error: "Não foi possível salvar. Tente de novo." };
  }
  if (isMe) {
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
  if (specs.ids.length || specs.custom) {
    const { error: specError } = await supabase.rpc("set_provider_specialties", { p_provider: data.id, p_specialty_ids: specs.ids, p_custom: specs.custom || null });
    if (specError) console.error("set_provider_specialties", specError); // o perfil já existe; só ficam sem as especialidades
  }
  revalidatePath(`/c/${slug}`, "layout");
  redirect(`/c/${slug}/p/${data.id}?novo=${isMe ? "eu" : "1"}`);
}

/** Troca as categorias de um perfil (autor ou admin). Devolve texto de erro em português ou null. */
async function saveCategories(slug: string, providerId: string, fd: FormData): Promise<string | null> {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(providerId)) return "Perfil inválido.";
  const cats = await readCategories(supabase, fd);
  if (!cats.ok) return cats.error;
  const specs = readSpecialties(fd);
  if (specs.error) return specs.error;
  const { error } = await supabase.rpc("set_provider_categories", {
    p_provider: providerId, p_category_ids: cats.ids, p_custom: cats.custom || null,
  });
  if (error) {
    if (error.message?.includes("sem permiss")) return "Só quem indicou este profissional ou a administração pode editar as categorias.";
    if (error.message?.includes("custom_required")) return "Diga qual é o serviço em “Outros”.";
    console.error("saveCategories", error);
    return "Não foi possível salvar as categorias.";
  }
  if (specs.present) {
    const { error: specError } = await supabase.rpc("set_provider_specialties", { p_provider: providerId, p_specialty_ids: specs.ids, p_custom: specs.custom || null });
    if (specError) {
      console.error("set_provider_specialties", specError);
      return "As categorias foram salvas, mas não foi possível salvar as especialidades.";
    }
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
  // A avaliação fica no condomínio do prestador (que pode ser outro da região).
  const { data: target } = await supabase.from("providers").select("condo_id").eq("id", providerId).maybeSingle();
  const { error } = await supabase
    .from("reviews")
    .insert({ condo_id: target?.condo_id ?? condo.id, provider_id: providerId, author_id: user.id, rating, comment, author_label: "" });
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
  // A denúncia vai para o condomínio do prestador (ou do prestador avaliado), que é quem modera.
  let targetCondo: string = condo.id;
  if (target === "provider") {
    const { data: t } = await supabase.from("providers").select("condo_id").eq("id", id).maybeSingle();
    if (t?.condo_id) targetCondo = t.condo_id as string;
  } else {
    const { data: t } = await supabase.from("reviews").select("condo_id").eq("id", id).maybeSingle();
    if (t?.condo_id) targetCondo = t.condo_id as string;
  }
  const { error } = await supabase.from("reports").insert({
    condo_id: targetCondo,
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

// ─── Etapa 2: chaves, plano Destaque, vitrine, respostas e anúncios ───
export async function adminSetFeature(slug: string, feature: string, enabled: boolean) {
  const { condo, supabase } = await requireAdmin(slug);
  if (!(FEATURES as readonly string[]).includes(feature)) return;
  await supabase
    .from("condo_features")
    .upsert({ condo_id: condo.id, feature, enabled, updated_at: new Date().toISOString() }, { onConflict: "condo_id,feature" });
  revalidatePath(`/c/${slug}`, "layout");
}

export async function startTrial(slug: string, providerId: string) {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(providerId)) redirect(`/c/${slug}`);
  const { error } = await supabase.rpc("start_trial", { p_provider: providerId });
  let flag = "ok";
  if (error) {
    const known = ["trial_used", "already_active", "plans_off", "not_owner"].find((k) => error.message?.includes(k));
    flag = known ?? "erro";
    if (!known) console.error("start_trial", error);
  }
  revalidatePath(`/c/${slug}`, "layout");
  redirect(`/c/${slug}/p/${providerId}?plano=${flag}`);
}

export async function adminGrantPlan(slug: string, providerId: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const days = Number(fd.get("days"));
  if (!UUID.test(providerId) || !Number.isInteger(days) || days < 1 || days > 366) return;
  await supabase.rpc("grant_plan", { p_provider: providerId, p_days: days, p_note: str(fd, "note").slice(0, 200) || null });
  revalidatePath(`/c/${slug}`, "layout");
}

export async function adminCancelPlan(slug: string, providerId: string) {
  const { supabase } = await requireAdmin(slug);
  if (!UUID.test(providerId)) return;
  await supabase.rpc("cancel_plan", { p_provider: providerId });
  revalidatePath(`/c/${slug}`, "layout");
}

function premiumError(message: string | undefined, fallback: string): string {
  if (message?.includes("premium_required")) return "Este recurso faz parte do plano Destaque.";
  if (message?.includes("sem permiss") || message?.includes("not_owner")) return "Só o dono do perfil pode fazer isso.";
  return fallback;
}

export async function saveShowcase(slug: string, providerId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(providerId)) return { error: "Perfil inválido." };
  const hours = str(fd, "hours");
  if (hours.length > 300) return { error: "Os horários devem ter até 300 caracteres." };
  const titles = fd.getAll("svc_title").map(String);
  const prices = fd.getAll("svc_price").map(String);
  const descs = fd.getAll("svc_desc").map(String);
  const items = titles
    .map((t, i) => ({ title: t.trim(), price: (prices[i] ?? "").trim(), description: (descs[i] ?? "").trim() }))
    .filter((x) => x.title || x.price || x.description);
  if (items.length > 12) return { error: "No máximo 12 serviços." };
  for (const it of items) {
    if (it.title.length < 2 || it.title.length > 80) return { error: "Cada serviço precisa de um nome (de 2 a 80 letras)." };
    if (it.price.length > 40) return { error: "O preço deve ter até 40 caracteres (ex.: “a partir de R$ 50”)." };
    if (it.description.length > 200) return { error: "A descrição de cada serviço deve ter até 200 caracteres." };
  }
  const { error } = await supabase.rpc("save_showcase", { p_provider: providerId, p_hours: hours || null, p_items: items });
  if (error) {
    console.error("saveShowcase", error);
    return { error: premiumError(error.message, "Não foi possível salvar a vitrine.") };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Vitrine atualizada!" };
}

export async function addGalleryPhoto(slug: string, providerId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireMember(slug);
  const url = str(fd, "gallery_url");
  if (!UUID.test(providerId) || !url) return { error: "Escolha uma foto." };
  const { error } = await supabase.rpc("add_provider_photo", { p_provider: providerId, p_url: url, p_caption: str(fd, "caption").slice(0, 80) || null });
  if (error) {
    if (error.message?.includes("max_photos")) return { error: "A galeria já tem 6 fotos. Remova uma para adicionar outra." };
    console.error("addGalleryPhoto", error);
    return { error: premiumError(error.message, "Não foi possível adicionar a foto.") };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Foto adicionada!" };
}

export async function removeGalleryPhoto(slug: string, photoId: string) {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(photoId)) return;
  await supabase.rpc("remove_provider_photo", { p_photo: photoId });
  revalidatePath(`/c/${slug}`, "layout");
}

export async function replyToReview(slug: string, reviewId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(reviewId)) return { error: "Avaliação inválida." };
  const msg = validateMessage(String(fd.get("reply") ?? ""), 500);
  if (!msg.ok) return { error: msg.error };
  const { error } = await supabase.rpc("reply_to_review", { p_review: reviewId, p_text: msg.text });
  if (error) {
    console.error("replyToReview", error);
    return { error: premiumError(error.message, "Não foi possível publicar a resposta.") };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Resposta publicada!" };
}

export async function deleteReviewReply(slug: string, reviewId: string) {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(reviewId)) return;
  await supabase.rpc("delete_review_reply", { p_review: reviewId });
  revalidatePath(`/c/${slug}`, "layout");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export async function adminSaveAd(slug: string, adId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, supabase } = await requireAdmin(slug);
  const advertiser = str(fd, "advertiser");
  const title = str(fd, "title");
  const body = str(fd, "body");
  const cta = str(fd, "cta_label") || "Saiba mais";
  const image_url = str(fd, "image_url") || null;
  const starts_on = str(fd, "starts_on") || null;
  const ends_on = str(fd, "ends_on") || null;
  if (advertiser.length < 2 || advertiser.length > 60) return { error: "Informe o nome do anunciante (até 60 letras)." };
  if (title.length < 2 || title.length > 60) return { error: "O título deve ter de 2 a 60 letras." };
  if (body.length > 140) return { error: "O texto deve ter até 140 caracteres." };
  if (cta.length < 2 || cta.length > 24) return { error: "O texto do botão deve ter de 2 a 24 letras." };
  const link = normalizeWebsite(str(fd, "link_url"));
  if (!link.ok) return { error: "Link inválido. Use um endereço como www.loja.com.br." };
  const rawWa = str(fd, "whatsapp");
  const wa = rawWa ? normalizeWhatsapp(rawWa) : null;
  if (rawWa && !wa) return { error: "WhatsApp inválido. Use o formato (11) 99999-8888." };
  if (!link.value && !wa) return { error: "Informe um link ou um WhatsApp para o botão do anúncio." };
  if (image_url && !image_url.includes("/ad-images/")) return { error: "Imagem inválida." };
  if ((starts_on && !DATE.test(starts_on)) || (ends_on && !DATE.test(ends_on))) return { error: "Datas inválidas." };
  if (starts_on && ends_on && ends_on < starts_on) return { error: "A data final deve ser depois da inicial." };
  const row = { advertiser, title, body: body || null, cta_label: cta, link_url: link.value, whatsapp: wa, image_url, starts_on, ends_on };
  const { error } = adId
    ? await supabase.from("ads").update(row).eq("id", adId).eq("condo_id", condo.id)
    : await supabase.from("ads").insert({ ...row, condo_id: condo.id, active: true });
  if (error) {
    console.error("adminSaveAd", error);
    return { error: "Não foi possível salvar o anúncio." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  if (!adId) redirect(`/c/${slug}/admin/configurar#anuncios`);
  return { ok: "Anúncio atualizado!" };
}

export async function adminSetAdActive(slug: string, adId: string, active: boolean) {
  const { condo, supabase } = await requireAdmin(slug);
  if (!UUID.test(adId)) return;
  await supabase.from("ads").update({ active }).eq("id", adId).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}

export async function adminDeleteAd(slug: string, adId: string) {
  const { condo, supabase } = await requireAdmin(slug);
  if (!UUID.test(adId)) return;
  await supabase.from("ads").delete().eq("id", adId).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}

// ─── Especialidades (Admin): lista e sugestões dos moradores ───
export async function adminSaveSpecialty(slug: string, specialtyId: number | null, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, supabase } = await requireAdmin(slug);
  const category_id = Number(fd.get("category_id"));
  const name = str(fd, "name");
  if (!Number.isInteger(category_id) || category_id <= 0) return { error: "Escolha a categoria." };
  if (name.length < 2 || name.length > 60) return { error: "O nome deve ter de 2 a 60 letras." };
  const { error } = await supabase.rpc("admin_save_specialty", {
    p_condo: condo.id, p_id: specialtyId, p_category_id: category_id, p_name: name, p_keywords: str(fd, "keywords").slice(0, 300),
  });
  if (error) {
    if (error.message?.includes("already_exists")) return { error: "Já existe uma especialidade com esse nome nesta categoria." };
    console.error("adminSaveSpecialty", error);
    return { error: "Não foi possível salvar a especialidade." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: specialtyId ? "Especialidade atualizada!" : "Especialidade criada!" };
}

export async function adminDeleteSpecialty(slug: string, specialtyId: number) {
  const { condo, supabase } = await requireAdmin(slug);
  const { error } = await supabase.rpc("admin_delete_specialty", { p_condo: condo.id, p_id: specialtyId });
  revalidatePath(`/c/${slug}`, "layout");
  if (error?.message?.includes("in_use_elsewhere")) redirect(`/c/${slug}/admin/especialidades?erro=em-uso`);
  if (error) console.error("adminDeleteSpecialty", error);
}

/** Cria a especialidade sugerida (ou reaproveita a de mesmo nome) e a atribui aos perfis do grupo. */
export async function adminApproveSpecialty(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFrom(fd);
  const category_id = Number(fd.get("category_id"));
  if (!ids.length || !Number.isInteger(category_id) || category_id <= 0) return;
  const { error } = await supabase.rpc("approve_specialty", {
    p_condo: condo.id, p_category_id: category_id, p_name: str(fd, "name"), p_keywords: str(fd, "keywords").slice(0, 300), p_provider_ids: ids,
  });
  if (error) console.error("adminApproveSpecialty", error);
  revalidatePath(`/c/${slug}`, "layout");
}

/** Atribui uma especialidade que já existe aos perfis do grupo. */
export async function adminAssignSpecialty(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFrom(fd);
  const specialty_id = Number(fd.get("specialty_id"));
  if (!ids.length || !Number.isInteger(specialty_id) || specialty_id <= 0) return;
  const { error } = await supabase.rpc("assign_specialty", { p_condo: condo.id, p_specialty_id: specialty_id, p_provider_ids: ids });
  if (error) console.error("adminAssignSpecialty", error);
  revalidatePath(`/c/${slug}`, "layout");
}

/** Mantém o texto como está (etiqueta livre) e tira da fila. */
export async function adminDismissSpecialtyText(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFrom(fd);
  if (!ids.length) return;
  await supabase.from("providers").update({ custom_specialty_reviewed: true }).in("id", ids).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}

/** Apaga o texto (spam, ofensa, erro). */
export async function adminClearSpecialtyText(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFrom(fd);
  if (!ids.length) return;
  await supabase.from("providers").update({ custom_specialty: null, custom_specialty_reviewed: false }).in("id", ids).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}


// ─── Categorias (Admin): gerenciar a lista ───
export async function adminSaveCategory(slug: string, categoryId: number | null, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, supabase } = await requireAdmin(slug);
  const group_id = Number(fd.get("group_id"));
  const name = str(fd, "name");
  if (!Number.isInteger(group_id) || group_id <= 0) return { error: "Escolha o grupo." };
  if (name.length < 2 || name.length > 40) return { error: "O nome deve ter de 2 a 40 letras." };
  const { error } = await supabase.rpc("admin_save_category", {
    p_condo: condo.id, p_id: categoryId, p_group_id: group_id, p_name: name,
    p_icon: str(fd, "icon").slice(0, 8), p_keywords: str(fd, "keywords").slice(0, 400),
  });
  if (error) {
    if (error.message?.includes("already_exists")) return { error: "Já existe uma categoria com esse nome." };
    if (error.message?.includes("protegida")) return { error: "Esta categoria é protegida e não pode ser alterada." };
    console.error("adminSaveCategory", error);
    return { error: "Não foi possível salvar a categoria." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: categoryId ? "Categoria atualizada!" : "Categoria criada!" };
}

export async function adminDeleteCategory(slug: string, categoryId: number, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const move = Number(fd.get("move_to"));
  const { error } = await supabase.rpc("admin_delete_category", {
    p_condo: condo.id, p_id: categoryId, p_move_to: Number.isInteger(move) && move > 0 ? move : null,
  });
  revalidatePath(`/c/${slug}`, "layout");
  if (error?.message?.includes("in_use_elsewhere")) redirect(`/c/${slug}/admin/categorias?erro=em-uso`);
  if (error?.message?.includes("need_target")) redirect(`/c/${slug}/admin/categorias?erro=destino`);
  if (error) console.error("adminDeleteCategory", error);
}

// Duplicidades em lote: "Está ok" ou ocultar vários perfis de uma vez.
function idsFromChecked(fd: FormData) {
  return fd.getAll("id").map(String).filter((s) => UUID.test(s));
}
export async function adminClearFlags(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFromChecked(fd);
  if (!ids.length) return;
  await supabase.from("providers").update({ flagged: false, flag_reason: null }).in("id", ids).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}
export async function adminHideFlagged(slug: string, fd: FormData) {
  const { condo, supabase } = await requireAdmin(slug);
  const ids = idsFromChecked(fd);
  if (!ids.length) return;
  await supabase.from("providers").update({ status: "hidden", flagged: false, flag_reason: null }).in("id", ids).eq("condo_id", condo.id);
  revalidatePath(`/c/${slug}`, "layout");
}

// "Como foi?": o morador diz que não contratou, e o convite para avaliar some.
export async function dismissReviewPrompt(slug: string, providerId: string) {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(providerId)) return;
  await supabase.rpc("dismiss_review_prompt", { p_provider: providerId });
  revalidatePath(`/c/${slug}`);
}

// Perfis em lote (Admin → Perfis). O banco só deixa mudar perfis dos condomínios que a pessoa administra.
export async function adminSetProvidersStatus(slug: string, status: "active" | "hidden", fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const ids = idsFromChecked(fd);
  if (!ids.length) return;
  await supabase.from("providers").update({ status }).in("id", ids);
  revalidatePath(`/c/${slug}`, "layout");
}
export async function adminClearProvidersFlags(slug: string, fd: FormData) {
  const { supabase } = await requireAdmin(slug);
  const ids = idsFromChecked(fd);
  if (!ids.length) return;
  await supabase.from("providers").update({ flagged: false, flag_reason: null }).in("id", ids);
  revalidatePath(`/c/${slug}`, "layout");
}

// ─── Plataforma (Admin → Condomínios): condomínios e regiões. Só o administrador da plataforma; o banco confirma. ───
function platformError(message: string | undefined, fallback: string): string {
  const m = message ?? "";
  if (m.includes("apenas o administrador da plataforma")) return "Só o administrador da plataforma pode fazer isso.";
  if (m.includes("slug_invalido")) return "O endereço deve ter de 3 a 40 letras minúsculas, números e hífen (ex.: parque-barueri).";
  if (m.includes("slug_em_uso")) return "Esse endereço já está em uso.";
  if (m.includes("nome_invalido")) return "O nome deve ter de 2 a 80 letras.";
  if (m.includes("regiao_invalida")) return "Região inválida.";
  if (m.includes("region_not_empty")) return "Não dá para apagar: ainda há condomínios nesta região. Mova-os antes.";
  return fallback;
}
const uuidOrNull = (v: FormDataEntryValue | null) => (typeof v === "string" && UUID.test(v) ? v : null);

export async function platformCreateCondo(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin(slug);
  const newSlug = str(fd, "slug").toLowerCase();
  const { error } = await supabase.rpc("platform_create_condo", { p_slug: newSlug, p_name: str(fd, "name"), p_region: uuidOrNull(fd.get("region_id")) });
  if (error) {
    console.error("platformCreateCondo", error.message);
    return { error: platformError(error.message, "Não foi possível criar o condomínio.") };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: `Condomínio criado! Link: /c/${newSlug} (você já é administrador dele).` };
}

export async function platformUpdateCondo(slug: string, condoId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin(slug);
  const region = uuidOrNull(fd.get("region_id"));
  const { error } = await supabase.rpc("platform_update_condo", {
    p_condo: condoId, p_name: str(fd, "name"), p_region: region, p_active: fd.get("active") === "on",
  });
  if (error) {
    if (error.message?.includes("whatsapp_conflict") && region) {
      const { data } = await supabase.rpc("platform_region_conflicts", { p_condo: condoId, p_region: region });
      const list = ((data ?? []) as { name_here: string; name_there: string; condo_there: string }[])
        .slice(0, 5).map((c) => `“${c.name_here}” (aqui) e “${c.name_there}” (${c.condo_there})`).join("; ");
      return { error: `Não dá para entrar nesta região: o mesmo WhatsApp está em perfis dos dois lados. Oculte ou apague um de cada par e tente de novo. ${list}` };
    }
    console.error("platformUpdateCondo", error.message);
    return { error: platformError(error.message, "Não foi possível salvar.") };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Condomínio atualizado!" };
}

export async function platformSaveRegion(slug: string, regionId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.rpc("platform_save_region", { p_id: regionId, p_slug: str(fd, "slug").toLowerCase(), p_name: str(fd, "name") });
  if (error) {
    console.error("platformSaveRegion", error.message);
    return { error: platformError(error.message, "Não foi possível salvar a região.") };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: regionId ? "Região atualizada!" : "Região criada!" };
}

export async function platformDeleteRegion(slug: string, regionId: string) {
  const { supabase } = await requireAdmin(slug);
  const { error } = await supabase.rpc("platform_delete_region", { p_id: regionId });
  revalidatePath(`/c/${slug}`, "layout");
  if (error?.message?.includes("region_not_empty")) redirect(`/c/${slug}/admin/condominios?erro=regiao-com-condominios`);
  if (error) console.error("platformDeleteRegion", error.message);
}

// Administradores de cada condomínio (só o administrador da plataforma; o banco confirma).
export async function platformSetAdmin(slug: string, condoId: string, userId: string, makeAdmin: boolean) {
  const { supabase } = await requireAdmin(slug);
  if (!UUID.test(condoId) || !UUID.test(userId)) return;
  const { error } = await supabase.rpc("platform_set_admin", { p_condo: condoId, p_user: userId, p_admin: makeAdmin });
  revalidatePath(`/c/${slug}`, "layout");
  if (error?.message?.includes("ultimo_admin")) redirect(`/c/${slug}/admin/condominios?erro=ultimo-admin&adm=${condoId}`);
  if (error) console.error("platformSetAdmin", error.message);
  redirect(`/c/${slug}/admin/condominios?adm=${condoId}`);
}

export async function platformAddAdminByEmail(slug: string, condoId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin(slug);
  const email = str(fd, "email");
  if (!email.includes("@")) return { error: "Informe um e-mail válido." };
  const { error } = await supabase.rpc("platform_add_admin_by_email", { p_condo: condoId, p_email: email });
  if (error) {
    if (error.message?.includes("usuario_nao_encontrado")) return { error: "Não achei esse e-mail. A pessoa precisa entrar no app uma vez (pode ser em qualquer condomínio) para ter conta." };
    console.error("platformAddAdminByEmail", error.message);
    return { error: platformError(error.message, "Não foi possível adicionar.") };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: "Administrador adicionado!" };
}

// Aprovação automática de perfis cadastrados pelo próprio (período de lançamento). Só o administrador da plataforma.
export async function platformSetAutoApprove(slug: string, condoId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin(slug);
  const off = fd.get("off") === "1";
  const day = str(fd, "until"); // AAAA-MM-DD
  let until: string | null = null;
  if (!off) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Escolha a data final." };
    until = new Date(`${day}T23:59:59-03:00`).toISOString(); // fim do dia em São Paulo
    if (Number.isNaN(Date.parse(until))) return { error: "Data inválida." };
  }
  const { error } = await supabase.rpc("platform_set_auto_approve", { p_condo: condoId, p_until: until });
  if (error) {
    console.error("platformSetAutoApprove", error.message);
    return { error: platformError(error.message, "Não foi possível salvar.") };
  }
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: off ? "Aprovação automática desligada." : "Aprovação automática ligada!" };
}

// ─── "Os vizinhos estão procurando": pedidos de indicação (valem para a região) ───
export async function requestIndication(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const { condo, supabase } = await requireMember(slug);
  const label = str(fd, "label").replace(/\s+/g, " ");
  if (label.length < 2 || label.length > 60) return { error: "Escreva o serviço em poucas palavras (de 2 a 60 letras)." };
  const { data, error } = await supabase.rpc("request_indication", { p_condo: condo.id, p_label: label });
  if (error) {
    if (error.message?.includes("limite_diario")) return { error: "Você já fez vários pedidos hoje. Tente de novo amanhã." };
    console.error("requestIndication", error.message);
    return { error: "Não foi possível enviar o pedido." };
  }
  revalidatePath(`/c/${slug}`, "layout");
  switch (data) {
    case "ja_existe": return { error: `Já existem indicações para isso. Busque por “${label}” na tela inicial.` };
    case "ja_pediu": return { ok: "Você já tinha pedido isso. Assim que alguém indicar, avisamos aqui." };
    case "em_analise": return { ok: "Pedido enviado! Ele aparece para os vizinhos depois de uma conferência da administração." };
    default: return { ok: "Pedido enviado! Os vizinhos vão ver e, se alguém indicar, avisamos aqui." };
  }
}

export async function cancelIndicationRequest(slug: string, key: string) {
  const { condo, supabase } = await requireMember(slug);
  await supabase.rpc("cancel_indication_request", { p_condo: condo.id, p_key: key });
  revalidatePath(`/c/${slug}`, "layout");
}

export async function ackRequestUpdate(slug: string, id: string) {
  const { supabase } = await requireMember(slug);
  if (!UUID.test(id)) return;
  await supabase.rpc("ack_request_update", { p_id: id });
  revalidatePath(`/c/${slug}`, "layout");
}

export async function adminDecideRequest(slug: string, id: string, approve: boolean) {
  const { condo, supabase } = await requireAdmin(slug);
  if (!UUID.test(id)) return;
  await supabase.rpc("admin_decide_request", { p_condo: condo.id, p_id: id, p_approve: approve });
  revalidatePath(`/c/${slug}`, "layout");
}
