"use client";
import { useActionState, useState } from "react";
import { createProvider } from "../../actions";
import type { Category, FormState } from "@/lib/types";
import type { GroupLike, Section } from "@/lib/groups";
import { CategoryPicker } from "@/components/CategoryPicker";
import { PhotoField } from "@/components/PhotoField";
import { SpecialtyPicker } from "@/components/SpecialtyPicker";
import type { Specialty } from "@/lib/specialties";

export function ProviderForm({
  slug,
  sections,
  userId,
  defaultBlock,
  defaultName,
  initialMode,
  specialties,
}: {
  slug: string;
  sections: Section<GroupLike, Category>[];
  userId: string;
  defaultBlock: string;
  defaultName: string;
  initialMode: "self" | "other";
  specialties: Specialty[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createProvider.bind(null, slug), undefined);
  const [mode, setMode] = useState<"self" | "other">(initialMode);
  const self = mode === "self";
  const [kind, setKind] = useState<"resident" | "external">("external");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [specialtyIds, setSpecialtyIds] = useState<number[]>([]);
  const allCategories = sections.flatMap((s) => s.categories);

  const isOther = sections.flatMap((s) => s.categories).some((c) => categoryIds.includes(c.id) && c.slug === "outros");

  return (
    <form action={action} className="space-y-4">
      <div role="radiogroup" aria-label="O que você quer fazer?" className="grid grid-cols-2 gap-2">
        {([["other", "👥", "Indicar alguém que conheço"], ["self", "🧰", "Cadastrar meu serviço"]] as const).map(([v, icon, label]) => (
          <button
            type="button"
            key={v}
            role="radio"
            aria-checked={mode === v}
            onClick={() => setMode(v)}
            className={`rounded-2xl border-2 p-3 text-left text-sm font-bold transition ${mode === v ? "border-brand-500 bg-brand-50" : "border-navy/10 bg-white"}`}
          >
            <span className="mr-1">{icon}</span>{label}
          </button>
        ))}
      </div>
      {self ? (
        <div className="space-y-2 rounded-2xl bg-sky-soft p-3 text-sm">
          <p><b>Divulgue seu serviço para os vizinhos.</b> Seu perfil entra no ar agora; a administração confirma que é você e libera o selo ✅.</p>
          <p className="text-navy/70">Disponível para moradores. Se você presta serviços e <b>não mora aqui</b>, peça a um vizinho que te indique; depois você assume o perfil em “Este perfil é meu”.</p>
          <input type="hidden" name="is_me" value="on" />
          <input type="hidden" name="kind" value="resident" />
          <input type="hidden" name="block" value={defaultBlock} />
        </div>
      ) : (
        <p className="rounded-2xl bg-sky-soft p-3 text-sm">Conhece um bom profissional? Indique para os vizinhos. Ele(a) poderá assumir o perfil depois.</p>
      )}
      <div>
        <label className="label" htmlFor="name">{self ? "Seu nome (ou do seu negócio)" : "Nome do profissional"}</label>
        <input key={mode} id="name" name="name" required maxLength={80} defaultValue={self ? defaultName : ""} className="input" placeholder={self ? "Ex.: Maria Costa Manicure" : "Ex.: João Silva"} />
      </div>
      <div>
        <span className="label">Categoria</span>
        <CategoryPicker sections={sections} value={categoryIds} onChange={setCategoryIds} />
        <p className="mt-1 text-xs text-navy/60">Faz mais de um tipo de serviço? Adicione até 3 categorias no mesmo perfil.</p>
      </div>
      <SpecialtyPicker specialties={specialties} categories={allCategories} categoryIds={categoryIds} value={specialtyIds} onChange={setSpecialtyIds} />
      {isOther && (
        <div className="space-y-1 rounded-2xl border-2 border-brand-500/50 bg-brand-50/60 p-3">
          <label className="label" htmlFor="custom_category">✍️ Qual é o tipo de serviço? (sugestão de categoria nova)</label>
          <input id="custom_category" name="custom_category" required minLength={2} maxLength={40} autoFocus className="input" placeholder="Ex.: Costureira, Fotógrafo, Tapeceiro…" />
          <p className="text-xs text-navy/70">Pronto, é só isso. A indicação já fica publicada e a administração analisa: se fizer sentido, cria a categoria e move o perfil para ela. Se a categoria já existir com outro nome, ela também ajusta para você.</p>
        </div>
      )}
      {!self && (<>
      <div>
        <span className="label">Quem é?</span>
        <div className="grid grid-cols-2 gap-2">
          {([["resident", "Mora aqui"], ["external", "Externo (você indica)"]] as const).map(([v, label]) => (
            <label key={v} className={`card cursor-pointer text-center text-sm ${kind === v ? "!border-brand-500 bg-brand-50 font-semibold" : ""}`}>
              <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </div>
      {kind === "resident" && (
        <div>
          <label className="label" htmlFor="block">Bloco / Torre do profissional</label>
          <input id="block" name="block" defaultValue={defaultBlock} maxLength={20} className="input" />
        </div>
      )}
      </>)}
      <div>
        <label className="label" htmlFor="whatsapp">WhatsApp</label>
        <input id="whatsapp" name="whatsapp" required inputMode="tel" className="input" placeholder="(11) 99999-8888" />
      </div>
      <div>
        <label className="label" htmlFor="description">Descrição (opcional)</label>
        <textarea id="description" name="description" rows={3} maxLength={500} className="input" placeholder={self ? "O que você faz, horários, diferenciais…" : "O que ele faz, horários, diferenciais…"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="instagram">Instagram (opcional)</label>
          <input id="instagram" name="instagram" maxLength={80} className="input" placeholder="@usuario" autoCapitalize="none" />
        </div>
        <div>
          <label className="label" htmlFor="website">Site (opcional)</label>
          <input id="website" name="website" maxLength={200} inputMode="url" className="input" placeholder="www.seusite.com.br" autoCapitalize="none" />
        </div>
      </div>
      <PhotoField userId={userId} onBusyChange={setUploading} />
      <p className="text-xs text-navy/60">
        {self ? "Ao publicar, você confirma que as informações são suas e verdadeiras." : "Ao indicar, você confirma que tem autorização para divulgar o contato deste profissional. Evite incluir dados pessoais além do WhatsApp."}
      </p>
      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending || uploading || categoryIds.length === 0} className="btn w-full">{pending ? "Publicando…" : self ? "Publicar meu perfil" : "Publicar indicação"}</button>
    </form>
  );
}
