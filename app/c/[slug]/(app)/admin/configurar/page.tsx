import Link from "next/link";
import { getFeatures, getRegionInfo, isPlatformAdmin, requireAdmin } from "@/lib/condo";
import type { Category, CategoryGroup } from "@/lib/types";
import { groupCategories } from "@/lib/groups";
import { PLACEMENT_LABEL, type AdPlacement } from "@/lib/ads";
import { FEATURES, FEATURE_INFO } from "@/lib/features";
import type { AdRow } from "@/lib/types";
import { AdForm } from "../AdForm";
import { adminDeleteAd, adminSetAdActive, adminSetFeature } from "../../../actions";

export const metadata = { title: "Configurar — Admin" };

export default async function AdminConfigurar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ anuncio?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { condo, user, supabase } = await requireAdmin(slug);
  const flags = await getFeatures(condo.id);
  const { data: adsData } = await supabase.from("ads").select("*").eq("condo_id", condo.id).order("created_at", { ascending: false });
  const ads = (adsData ?? []) as AdRow[];
  const editingAd = sp.anuncio ? ads.find((a) => a.id === sp.anuncio) : undefined;
  // Para os anúncios por categoria e da região
  const [{ data: catData }, { data: groupData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
  ]);
  const adSections = groupCategories((groupData ?? []) as CategoryGroup[], ((catData ?? []) as Category[]).filter((c) => c.slug !== "outros"));
  const canRegion = await isPlatformAdmin();
  const hasRegion = Boolean(await getRegionInfo(condo.id));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">📚 Listas (valem para todos os condomínios)</h2>
        <Link href={`/c/${slug}/admin/categorias`} className="card flex items-center gap-3 transition hover:border-brand-500">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xl">🗂️</span>
          <span className="min-w-0 flex-1">
            <b>Categorias</b>
            <span className="block text-sm text-navy/65">Criar, editar, mover de grupo e excluir</span>
          </span>
          <span className="text-navy/40" aria-hidden>›</span>
        </Link>
        <Link href={`/c/${slug}/admin/especialidades`} className="card flex items-center gap-3 transition hover:border-brand-500">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xl">🩺</span>
          <span className="min-w-0 flex-1">
            <b>Especialidades</b>
            <span className="block text-sm text-navy/65">Gerenciar a lista dentro de cada categoria</span>
          </span>
          <span className="text-navy/40" aria-hidden>›</span>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">🧩 Funcionalidades do condomínio</h2>
        <p className="text-sm text-navy/65">Tudo começa desligado e ninguém vê nada. Ligue uma por vez, quando quiser. Qualquer chave pode ser desligada a qualquer momento.</p>
        <div className="space-y-2">
          {FEATURES.map((f) => {
            const info = FEATURE_INFO[f];
            const on = flags[f];
            return (
              <div key={f} className="card flex items-start gap-3 !p-3">
                <span className="text-2xl" aria-hidden>{info.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{info.label} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${on ? "bg-green-50 text-green-700" : "bg-navy/10 text-navy/60"}`}>{on ? "Ligado" : "Desligado"}</span></div>
                  <p className="text-sm text-navy/65">{info.description}</p>
                </div>
                <form action={adminSetFeature.bind(null, slug, f, !on)}>
                  <button className={on ? "btn-secondary !px-3 !py-2 !text-sm" : "btn !px-3 !py-2 !text-sm"}>{on ? "Desligar" : "Ligar"}</button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      {(flags.ads || ads.length > 0) && (
        <section id="anuncios" className="space-y-3">
          <h2 className="font-semibold">📢 Anunciantes locais ({ads.length}){!flags.ads && <span className="ml-2 text-xs font-normal text-navy/55">(chave desligada: nada aparece para os moradores)</span>}</h2>
          {ads.map((a) => {
            return (
              <div key={a.id} className="card space-y-2 !p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold">{a.title}</div>
                    <div className="mb-0.5 flex flex-wrap gap-1 text-[11px] font-bold">
                      {a.scope === "region" && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">🌎 Região</span>}
                      {((a.placements ?? ["home"]) as AdPlacement[]).map((p) => <span key={p} className="rounded-full bg-sky-soft px-2 py-0.5 text-sky-brand">{PLACEMENT_LABEL[p]}</span>)}
                    </div>
                    <div className="text-navy/65">{a.advertiser}{a.starts_on || a.ends_on ? ` · ${a.starts_on ? new Date(a.starts_on + "T12:00:00").toLocaleDateString("pt-BR") : "…"} a ${a.ends_on ? new Date(a.ends_on + "T12:00:00").toLocaleDateString("pt-BR") : "sem fim"}` : ""}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${a.active ? "bg-green-50 text-green-700" : "bg-navy/10 text-navy/60"}`}>{a.active ? "Ativo" : "Pausado"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/c/${slug}/admin/configurar?anuncio=${a.id}#anuncios`} className="font-bold text-sky-brand underline">Editar</Link>
                  <form action={adminSetAdActive.bind(null, slug, a.id, !a.active)}><button className="font-semibold text-navy/70 underline">{a.active ? "Pausar" : "Reativar"}</button></form>
                  <form action={adminDeleteAd.bind(null, slug, a.id)}><button className="font-semibold text-red-700 underline">Excluir</button></form>
                </div>
              </div>
            );
          })}
          <details className="card !p-3" open={Boolean(editingAd)}>
            <summary className="cursor-pointer font-bold text-sky-brand">{editingAd ? `✏️ Editando: ${editingAd.title}` : "＋ Novo anúncio"}</summary>
            <div className="mt-3"><AdForm key={editingAd?.id ?? "novo"} slug={slug} userId={user.id} ad={editingAd} sections={adSections} canRegion={canRegion} hasRegion={hasRegion} /></div>
          </details>
        </section>
      )}
    </div>
  );
}
