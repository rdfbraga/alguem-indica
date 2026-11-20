import Link from "next/link";
import { requireAdmin } from "@/lib/condo";
import type { Category, CategoryGroup } from "@/lib/types";
import { groupCategories } from "@/lib/groups";
import { capitalizeFirst, findSimilarCategories, groupByLabel } from "@/lib/suggestions";
import { categoriesByFrequency, commonCategoryIds } from "@/lib/specialty-admin";
import {
  adminApproveSpecialty,
  adminAssignSpecialty,
  adminClearSpecialtyText,
  adminDeleteSpecialty,
  adminDismissSpecialtyText,
} from "../../../actions";
import { SpecialtyAdminForm } from "./SpecialtyAdminForm";

export const metadata = { title: "Especialidades — Admin" };

type Spec = { id: number; category_id: number; slug: string; name: string; keywords: string; sort: number };
type Pending = { id: string; name: string; custom_specialty: string | null };

export default async function AdminEspecialidades({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const { condo, supabase } = await requireAdmin(slug);

  const [{ data: catData }, { data: groupData }, { data: specData }, { data: cntData }, { data: pendData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
    supabase.from("specialties").select("id,category_id,slug,name,keywords,sort").order("sort"),
    supabase.rpc("specialty_counts", { p_condo: condo.id }),
    supabase.from("providers").select("id,name,custom_specialty")
      .eq("condo_id", condo.id).not("custom_specialty", "is", null).eq("custom_specialty_reviewed", false).order("created_at", { ascending: false }),
  ]);
  const categories = (catData ?? []) as Category[];
  const specs = (specData ?? []) as Spec[];
  const sections = groupCategories((groupData ?? []) as CategoryGroup[], categories.filter((c) => c.slug !== "outros"));
  const counts = new Map(((cntData ?? []) as { specialty_id: number; n: number }[]).map((r) => [r.specialty_id, Number(r.n)]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const pending = (pendData ?? []) as Pending[];

  // categorias de cada perfil da fila (para sugerir só o que se aplica)
  const provCats = new Map<string, number[]>();
  if (pending.length) {
    const { data: pc } = await supabase.from("provider_categories").select("provider_id,category_id").in("provider_id", pending.map((p) => p.id));
    for (const r of (pc ?? []) as { provider_id: string; category_id: number }[]) provCats.set(r.provider_id, [...(provCats.get(r.provider_id) ?? []), r.category_id]);
  }
  const groups = groupByLabel(pending, (p) => p.custom_specialty);
  const byCategory = new Map<number, Spec[]>();
  for (const s of specs) byCategory.set(s.category_id, [...(byCategory.get(s.category_id) ?? []), s]);
  const listed = sections
    .map((sec) => ({ ...sec, categories: sec.categories.filter((c) => (byCategory.get(c.id) ?? []).length > 0) }))
    .filter((sec) => sec.categories.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/c/${slug}/admin`} className="text-sm text-navy/60">← Painel admin</Link>
        <h1 className="mt-1 text-xl font-bold">🩺 Especialidades</h1>
        <p className="text-sm text-navy/65">
          A lista é <b>a mesma para todos os condomínios</b>, como a de categorias. Aqui você aprova o que os moradores escrevem em “Outra especialidade” e cuida da lista.
        </p>
      </div>
      {erro === "em-uso" && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          Não dá para excluir: outro condomínio também usa essa especialidade. Você pode editar o nome ou as palavras de busca.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">✍️ Sugestões dos moradores ({groups.length})</h2>
        {groups.map((g) => {
          const ids = g.items.map((i) => i.id).join(",");
          const lists = g.items.map((i) => provCats.get(i.id) ?? []);
          const ranked = categoriesByFrequency(lists);
          const common = commonCategoryIds(lists);
          const createCats = ranked.map((id) => catById.get(id)).filter(Boolean) as Category[];
          const pool = specs.filter((s) => ranked.includes(s.category_id));
          const similar = findSimilarCategories(g.label, pool.map((s) => ({ ...s, keywords: s.keywords })));
          const moveOptions = specs.filter((s) => common.includes(s.category_id));
          return (
            <div key={g.key} className="card space-y-3">
              <div>
                <div className="text-lg font-extrabold">{g.label}</div>
                <p className="text-sm text-navy/60">
                  {g.items.length} perfil(is):{" "}
                  {g.items.map((i, k) => <span key={i.id}>{k > 0 && ", "}<Link className="underline" href={`/c/${slug}/p/${i.id}`}>{i.name}</Link></span>)}
                </p>
              </div>

              {similar.length > 0 ? (
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-sm font-bold text-amber-800">🔎 Já existe algo parecido. Talvez não precise criar:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {similar.map((s) => (
                      <form key={s.id} action={adminAssignSpecialty.bind(null, slug)}>
                        <input type="hidden" name="ids" value={ids} />
                        <input type="hidden" name="specialty_id" value={s.id} />
                        <button className="rounded-full border-2 border-amber-300 bg-white px-3 py-1 text-sm font-bold hover:bg-amber-100" title="Atribuir esta especialidade a estes perfis">
                          {s.name}<span className="font-normal text-navy/50"> · {catById.get(s.category_id)?.name}</span>
                          <span className="ml-1 text-brand-700">→ usar</span>
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">✅ Nenhuma especialidade parecida. Pode criar.</p>
              )}

              {createCats.length > 0 && (
                <form action={adminApproveSpecialty.bind(null, slug)} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="ids" value={ids} />
                  <div className="min-w-36 flex-1">
                    <label className="label !text-xs">Nome da nova especialidade</label>
                    <input name="name" required minLength={2} maxLength={60} defaultValue={capitalizeFirst(g.label)} className="input !py-2" />
                  </div>
                  <div className="min-w-36">
                    <label className="label !text-xs">Em qual categoria</label>
                    <select name="category_id" required defaultValue={createCats[0].id} className="input !py-2">
                      {createCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                  <div className="w-full">
                    <label className="label !text-xs">Palavras para a busca (opcional)</label>
                    <input name="keywords" maxLength={300} className="input !py-2" placeholder="sinônimos, separados por espaço" />
                  </div>
                  <button className="btn !px-3 !py-2 !text-sm">Criar e atribuir</button>
                </form>
              )}

              {moveOptions.length > 0 && (
                <form action={adminAssignSpecialty.bind(null, slug)} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="ids" value={ids} />
                  <select name="specialty_id" required defaultValue="" className="input min-w-40 flex-1 !py-2">
                    <option value="" disabled>Usar uma especialidade existente…</option>
                    {sections.flatMap((sec) => sec.categories).filter((c) => common.includes(c.id)).map((c) => (
                      <optgroup key={c.id} label={`${c.icon} ${c.name}`}>
                        {specs.filter((s) => s.category_id === c.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button className="btn-secondary !px-3 !py-2 !text-sm">Usar</button>
                </form>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <form action={adminDismissSpecialtyText.bind(null, slug)}>
                  <input type="hidden" name="ids" value={ids} />
                  <button className="text-sm font-semibold text-navy/60 underline">Manter como texto livre (tirar da fila)</button>
                </form>
                <form action={adminClearSpecialtyText.bind(null, slug)}>
                  <input type="hidden" name="ids" value={ids} />
                  <button className="text-sm font-semibold text-red-700 underline">Apagar o texto</button>
                </form>
              </div>
            </div>
          );
        })}
        {groups.length === 0 && <p className="text-sm text-navy/60">Nenhuma sugestão pendente. 🎉</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">📋 Lista de especialidades ({specs.length})</h2>
        <details className="card !p-3">
          <summary className="cursor-pointer font-bold text-sky-brand">＋ Nova especialidade</summary>
          <div className="mt-3"><SpecialtyAdminForm slug={slug} sections={sections} /></div>
        </details>
        {listed.map((sec) => (
          <div key={sec.group.id} className="space-y-2">
            <div className="text-sm font-extrabold text-navy/70">{sec.group.icon} {sec.group.name}</div>
            {sec.categories.map((c) => {
              const items = byCategory.get(c.id) ?? [];
              return (
                <details key={c.id} className="card !p-3">
                  <summary className="cursor-pointer font-bold">{c.icon} {c.name} <span className="font-normal text-navy/55">· {items.length} especialidades</span></summary>
                  <ul className="mt-3 divide-y divide-navy/10">
                    {items.map((s) => (
                      <li key={s.id} className="py-2">
                        <details>
                          <summary className="flex cursor-pointer items-center justify-between gap-2">
                            <span className="font-semibold">{s.name}</span>
                            <span className="shrink-0 text-xs text-navy/55">{counts.get(s.id) ?? 0} {(counts.get(s.id) ?? 0) === 1 ? "perfil" : "perfis"} aqui</span>
                          </summary>
                          <div className="mt-3 space-y-3 rounded-2xl bg-sky-soft p-3">
                            <SpecialtyAdminForm slug={slug} sections={sections} specialty={{ id: s.id, category_id: s.category_id, name: s.name, keywords: s.keywords }} />
                            <details className="text-sm">
                              <summary className="cursor-pointer font-semibold text-red-700">Excluir esta especialidade</summary>
                              <form action={adminDeleteSpecialty.bind(null, slug, s.id)} className="mt-2 space-y-2">
                                <p className="text-navy/75">
                                  {(counts.get(s.id) ?? 0) > 0
                                    ? `Quem usa (${counts.get(s.id)}) fica com o nome como texto livre. `
                                    : "Ninguém usa esta especialidade neste condomínio. "}
                                  Não dá para desfazer.
                                </p>
                                <button className="btn-secondary !border-red-300 !px-3 !py-2 !text-sm !text-red-700">Sim, excluir</button>
                              </form>
                            </details>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}
