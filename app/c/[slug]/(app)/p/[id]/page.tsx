import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/condo";
import { formatWhatsapp, whatsappLink } from "@/lib/phone";
import type { Category, CategoryGroup, ProviderRow, ReviewRow } from "@/lib/types";
import { Stars } from "@/components/Stars";
import { providerCategoryLabels, parseCategoryIds } from "@/lib/categories";
import { groupCategories } from "@/lib/groups";
import { addCategoriesAndReturn } from "../../../actions";
import { EditCategories } from "./EditCategories";
import { ReportButton } from "@/components/ReportButton";
import { ReviewForm } from "./ReviewForm";

export default async function Prestador({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ novo?: string; jaexiste?: string; addcat?: string; catsOk?: string; catsErro?: string }>;
}) {
  const { slug, id } = await params;
  const { novo, jaexiste, addcat, catsOk, catsErro } = await searchParams;
  const { condo, user, member, supabase } = await requireMember(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await supabase.from("provider_listing").select("*").eq("id", id).eq("condo_id", condo.id).maybeSingle();
  if (!data) notFound();
  const p = data as ProviderRow;
  const { data: rs } = await supabase
    .from("reviews").select("*").eq("provider_id", id).eq("status", "visible").order("created_at", { ascending: false });
  const reviews = (rs ?? []) as ReviewRow[];
  const mine = reviews.some((r) => r.author_id === user.id);
  const msg = `Olá, ${p.name}! Vi seu perfil no Alguém indica? (${condo.name}). Pode me ajudar?`;

  // Categorias: só autor/admin editam. O aviso "já cadastrado" pode sugerir incluir uma categoria nova.
  const canEdit = p.created_by === user.id || member.role === "admin";
  const currentIds = p.category_ids?.length ? p.category_ids : p.category_id ? [p.category_id] : [];
  const wantedIds = parseCategoryIds((addcat ?? "").split(",")).filter((x) => !currentIds.includes(x));
  let sections: ReturnType<typeof groupCategories<CategoryGroup, Category>> = [];
  if (canEdit || wantedIds.length) {
    const [{ data: cd }, { data: gd }] = await Promise.all([
      supabase.from("categories").select("*").order("sort"),
      supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
    ]);
    sections = groupCategories((gd ?? []) as CategoryGroup[], (cd ?? []) as Category[]) as typeof sections;
  }
  const allCats = sections.flatMap((s) => s.categories);
  const wantedNames = wantedIds.map((i) => allCats.find((c) => c.id === i)?.name).filter(Boolean) as string[];
  const mergedIds = [...currentIds, ...wantedIds];
  const mergedHasOther = allCats.some((c) => mergedIds.includes(c.id) && c.slug === "outros");

  return (
    <div className="space-y-4">
      <Link href={`/c/${slug}/categoria/${p.category_slug}`} className="text-sm text-navy/60">← {p.category_name}</Link>
      {novo && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Indicação publicada! Obrigado por ajudar os vizinhos. 🎉</p>}
      {jaexiste && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Este profissional já estava cadastrado. Que tal avaliá-lo?</p>}
      {catsOk && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Categorias atualizadas! ✅</p>}
      {catsErro && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">Não foi possível atualizar as categorias. Tente de novo pelo botão “Editar categorias”.</p>}
      {wantedNames.length > 0 && (
        <div className="card space-y-3 !border-amber-200 !bg-amber-50">
          <p className="text-sm text-amber-900">
            Você tentou indicar <b>{p.name}</b> em <b>{wantedNames.join(", ")}</b>, mas ele(a) já está cadastrado(a) em <b>{providerCategoryLabels(p).join(", ")}</b>.
          </p>
          {canEdit && mergedIds.length <= 3 ? (
            <form action={addCategoriesAndReturn.bind(null, slug, id)} className="space-y-2">
              {mergedIds.map((cid) => <input key={cid} type="hidden" name="category_id" value={cid} />)}
              {mergedHasOther && (
                <input name="custom_category" defaultValue={p.custom_category ?? ""} required minLength={2} maxLength={40} className="input" placeholder="Qual serviço em “Outros”? Ex.: Costureira" />
              )}
              <button className="btn !px-4 !py-2 !text-sm">Incluir {wantedNames.join(", ")} neste perfil</button>
            </form>
          ) : canEdit ? (
            <p className="text-sm text-amber-900">O perfil já tem o máximo de 3 categorias. Use “Editar categorias” abaixo para trocar uma delas.</p>
          ) : (
            <p className="text-sm text-amber-900">
              Só quem indicou ou a administração pode incluir categorias.{" "}
              <Link className="font-bold underline" href={`/c/${slug}/ajuda?tipo=sugestao&msg=${encodeURIComponent(`Incluir a categoria "${wantedNames.join(", ")}" no perfil de "${p.name}".`)}`}>
                Pedir à administração
              </Link>
            </p>
          )}
        </div>
      )}
      {p.status === "hidden" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Perfil oculto (visível só para administradores).</p>}

      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-4xl">{p.category_icon}</div>
          )}
          <div>
            <h1 className="text-xl font-bold">{p.name}</h1>
            <div className="text-sm text-navy/60">
              {providerCategoryLabels(p).join(" · ")} · {p.kind === "resident" ? `Morador${p.block ? ` (Bloco ${p.block})` : ""}` : "Externo indicado por morador"}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {p.review_count > 0 ? (
                <><Stars value={p.avg_rating} /><span className="text-sm text-navy/60">{Number(p.avg_rating).toFixed(1)} ({p.review_count})</span></>
              ) : <span className="text-sm text-navy/45">Sem avaliações ainda</span>}
            </div>
          </div>
        </div>
        {p.description && <p className="whitespace-pre-line text-navy/80">{p.description}</p>}
        <a href={whatsappLink(p.whatsapp, msg)} target="_blank" rel="noopener noreferrer" className="btn w-full !bg-[#25D366] hover:!bg-[#1ebe57]">
          💬 Chamar no WhatsApp · {formatWhatsapp(p.whatsapp)}
        </a>
        {canEdit && sections.length > 0 && (
          <details className="rounded-2xl border border-navy/10 p-3">
            <summary className="cursor-pointer text-sm font-bold text-sky-brand">✏️ Editar categorias</summary>
            <EditCategories slug={slug} providerId={p.id} sections={sections} initialIds={currentIds} initialCustom={p.custom_category ?? ""} />
          </details>
        )}
        <ReportButton slug={slug} target="provider" id={p.id} />
      </div>

      {!mine && <ReviewForm slug={slug} providerId={p.id} />}

      <section className="space-y-3">
        <h2 className="font-semibold">Avaliações dos vizinhos ({reviews.length})</h2>
        {reviews.map((r) => (
          <div key={r.id} className="card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.author_label}</span>
              <Stars value={r.rating} size="text-sm" />
            </div>
            {r.comment && <p className="text-navy/80">{r.comment}</p>}
            <div className="flex items-center justify-between text-xs text-navy/45">
              <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
              {r.author_id !== user.id && <ReportButton slug={slug} target="review" id={r.id} />}
            </div>
          </div>
        ))}
        {reviews.length === 0 && <p className="text-sm text-navy/60">Seja o primeiro vizinho a avaliar.</p>}
      </section>
      {member.role === "admin" && p.flagged && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">⚠️ Sinalizado: {p.flag_reason}</p>
      )}
    </div>
  );
}
