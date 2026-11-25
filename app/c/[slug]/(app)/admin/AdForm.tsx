"use client";
import { useActionState, useState } from "react";
import { adminSaveAd } from "../../actions";
import { PhotoField } from "@/components/PhotoField";
import { formatWhatsapp } from "@/lib/phone";
import type { AdRow, Category, FormState } from "@/lib/types";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { GroupLike, Section } from "@/lib/groups";
import { PLACEMENT_LABEL, type AdPlacement } from "@/lib/ads";

/** Cria ou edita um anúncio. Precisa de um link OU um WhatsApp para o botão. */
export function AdForm({
  slug, userId, ad, sections, canRegion, hasRegion,
}: {
  slug: string; userId: string; ad?: AdRow; sections: Section<GroupLike, Category>[]; canRegion: boolean; hasRegion: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(adminSaveAd.bind(null, slug, ad?.id ?? null), undefined);
  const [busy, setBusy] = useState(false);
  const [places, setPlaces] = useState<AdPlacement[]>((ad?.placements as AdPlacement[] | undefined) ?? ["home"]);
  const [cats, setCats] = useState<number[]>(ad?.category_ids ?? []);
  const usesTargets = places.includes("category") || places.includes("search");
  const toggle = (p: AdPlacement) => setPlaces((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ad-advertiser">Anunciante</label>
          <input id="ad-advertiser" name="advertiser" required minLength={2} maxLength={60} defaultValue={ad?.advertiser} className="input" placeholder="Pizzaria Boa" />
        </div>
        <div>
          <label className="label" htmlFor="ad-title">Título do anúncio</label>
          <input id="ad-title" name="title" required minLength={2} maxLength={60} defaultValue={ad?.title} className="input" placeholder="Pizza em dobro às terças" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ad-body">Texto (opcional, até 140 caracteres)</label>
        <textarea id="ad-body" name="body" rows={2} maxLength={140} defaultValue={ad?.body ?? ""} className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="ad-cta">Texto do botão</label>
          <input id="ad-cta" name="cta_label" maxLength={24} defaultValue={ad?.cta_label ?? "Saiba mais"} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ad-link">Link (site ou Instagram)</label>
          <input id="ad-link" name="link_url" maxLength={300} inputMode="url" defaultValue={ad?.link_url ?? ""} className="input" placeholder="www.loja.com.br" autoCapitalize="none" />
        </div>
        <div>
          <label className="label" htmlFor="ad-wa">ou WhatsApp</label>
          <input id="ad-wa" name="whatsapp" inputMode="tel" defaultValue={ad?.whatsapp ? formatWhatsapp(ad.whatsapp) : ""} className="input" placeholder="(11) 99999-8888" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ad-start">Começa em (opcional)</label>
          <input id="ad-start" type="date" name="starts_on" defaultValue={ad?.starts_on ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ad-end">Termina em (opcional)</label>
          <input id="ad-end" type="date" name="ends_on" defaultValue={ad?.ends_on ?? ""} className="input" />
        </div>
      </div>
      <fieldset className="space-y-2 rounded-2xl bg-sky-soft p-3">
        <legend className="px-1 text-sm font-extrabold">Onde o anúncio aparece</legend>
        {(Object.keys(PLACEMENT_LABEL) as AdPlacement[]).map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="placement" value={p} checked={places.includes(p)} onChange={() => toggle(p)} className="h-5 w-5" />
            {PLACEMENT_LABEL[p]}
          </label>
        ))}
        {usesTargets && (
          <div className="space-y-2 border-t border-navy/10 pt-2">
            <p className="text-xs text-navy/65">
              <b>Categorias</b> (até 5): {places.includes("category") ? "dentro de categorias, sem escolher nenhuma o anúncio aparece em todas. " : ""}
              {places.includes("search") ? "Nos resultados de busca, aparece quando a busca traz profissionais dessas categorias." : ""}
            </p>
            <CategoryPicker sections={sections} value={cats} onChange={setCats} max={5} />
            {places.includes("search") && (
              <div>
                <label className="label !text-xs" htmlFor="ad-kw">Palavras da busca (opcional, separadas por vírgula)</label>
                <input id="ad-kw" name="keywords" maxLength={120} defaultValue={ad?.keywords ?? ""} className="input !py-2" placeholder="fio, tomada, material elétrico" />
                <p className="mt-1 text-xs text-navy/55">Na busca é preciso escolher ao menos uma categoria ou uma palavra.</p>
              </div>
            )}
          </div>
        )}
      </fieldset>
      {hasRegion && (
        <label className={`flex items-start gap-2 rounded-2xl p-3 text-sm ${canRegion ? "bg-brand-50" : "bg-navy/5 opacity-70"}`}>
          <input type="checkbox" name="region" disabled={!canRegion && ad?.scope !== "region"} defaultChecked={ad?.scope === "region"} className="mt-0.5 h-5 w-5" />
          <span><b>🌎 Anúncio da região:</b> aparece em todos os condomínios da região, não só neste. {canRegion ? "" : "Só o administrador da plataforma cria."}</span>
        </label>
      )}
      <PhotoField userId={userId} bucket="ad-images" name="image_url" label="Imagem ou logo (opcional)" initialUrl={ad?.image_url ?? ""} onBusyChange={setBusy} />
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">{state.ok}</p>}
      <button disabled={pending || busy} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : ad ? "Salvar anúncio" : "Criar anúncio"}</button>
    </form>
  );
}
