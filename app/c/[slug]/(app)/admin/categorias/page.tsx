import Link from "next/link";
import { requireAdmin } from "@/lib/condo";
import type { Category, CategoryGroup } from "@/lib/types";
import { groupCategories } from "@/lib/groups";
import { adminDeleteCategory } from "../../../actions";
import { CategoryAdminForm } from "./CategoryAdminForm";

export const metadata = { title: "Categorias — Admin" };

export default async function AdminCategorias({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const { condo, supabase } = await requireAdmin(slug);

  const [{ data: catData }, { data: groupData }, { data: cntData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
    supabase.rpc("category_counts", { p_condo: condo.id }),
  ]);
  const groups = (groupData ?? []) as CategoryGroup[];
  const categories = ((catData ?? []) as Category[]).filter((c) => c.slug !== "outros");
  const sections = groupCategories(groups, categories);
  const counts = new Map(((cntData ?? []) as { category_id: number; n: number }[]).map((r) => [r.category_id, Number(r.n)]));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/c/${slug}/admin/configurar`} className="text-sm text-navy/60">← Configurar</Link>
        <h1 className="mt-1 text-lg font-bold">🗂️ Categorias</h1>
        <p className="text-sm text-navy/65">
          A lista é <b>a mesma para todos os condomínios</b>. Aqui você cria, renomeia, move de grupo e exclui categorias.
        </p>
      </div>
      {erro === "em-uso" && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          Não dá para excluir: outro condomínio também usa essa categoria. Você pode renomeá-la ou movê-la de grupo.
        </p>
      )}
      {erro === "destino" && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          Escolha para qual categoria os profissionais serão movidos antes de excluir.
        </p>
      )}

      <details className="card !p-3">
        <summary className="cursor-pointer font-bold text-sky-brand">＋ Nova categoria</summary>
        <div className="mt-3"><CategoryAdminForm slug={slug} groups={groups} /></div>
      </details>

      {sections.map((sec) => (
        <section key={sec.group.id} className="space-y-2">
          <div className="text-sm font-extrabold text-navy/70">{sec.group.icon} {sec.group.name}</div>
          {sec.categories.map((c) => {
            const n = counts.get(c.id) ?? 0;
            return (
              <details key={c.id} className="card !p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="font-bold">{c.icon} {c.name}</span>
                  <span className="shrink-0 text-xs text-navy/55">{n} {n === 1 ? "perfil" : "perfis"} aqui</span>
                </summary>
                <div className="mt-3 space-y-3 rounded-2xl bg-sky-soft p-3">
                  {"id" in sec.group && sec.group.id === 0 && (
                    <p className="text-xs text-navy/60">Esta categoria está sem grupo. Escolha um abaixo.</p>
                  )}
                  <CategoryAdminForm slug={slug} groups={groups} category={c} />
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-red-700">Excluir esta categoria</summary>
                    <form action={adminDeleteCategory.bind(null, slug, c.id)} className="mt-2 space-y-2">
                      {n > 0 ? (
                        <>
                          <p className="text-navy/75">
                            {n} {n === 1 ? "perfil usa" : "perfis usam"} esta categoria. Eles serão movidos para a que você escolher
                            (as especialidades deles viram texto livre).
                          </p>
                          <select name="move_to" required defaultValue="" className="input !py-2">
                            <option value="" disabled>Mover para…</option>
                            {sections.map((s2) => (
                              <optgroup key={s2.group.id} label={`${s2.group.icon} ${s2.group.name}`}>
                                {s2.categories.filter((o) => o.id !== c.id).map((o) => <option key={o.id} value={o.id}>{o.icon} {o.name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </>
                      ) : (
                        <p className="text-navy/75">Ninguém usa esta categoria neste condomínio.</p>
                      )}
                      <p className="text-navy/75">Não dá para desfazer.</p>
                      <button className="btn-secondary !border-red-300 !px-3 !py-2 !text-sm !text-red-700">Sim, excluir</button>
                    </form>
                  </details>
                </div>
              </details>
            );
          })}
        </section>
      ))}
    </div>
  );
}
