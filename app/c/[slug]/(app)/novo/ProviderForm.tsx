"use client";
import { useActionState, useState } from "react";
import { createProvider } from "../../actions";
import type { Category, FormState } from "@/lib/types";
import type { GroupLike, Section } from "@/lib/groups";
import { CategoryPicker } from "@/components/CategoryPicker";
import { PhotoField } from "@/components/PhotoField";

export function ProviderForm({
  slug,
  sections,
  userId,
  defaultBlock,
}: {
  slug: string;
  sections: Section<GroupLike, Category>[];
  userId: string;
  defaultBlock: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createProvider.bind(null, slug), undefined);
  const [kind, setKind] = useState<"resident" | "external">("external");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);

  const isOther = sections.flatMap((s) => s.categories).some((c) => categoryIds.includes(c.id) && c.slug === "outros");

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Nome do profissional</label>
        <input id="name" name="name" required maxLength={80} className="input" placeholder="Ex.: João Silva" />
      </div>
      <div>
        <span className="label">Categoria</span>
        <CategoryPicker sections={sections} value={categoryIds} onChange={setCategoryIds} />
        <p className="mt-1 text-xs text-navy/60">Faz mais de um tipo de serviço? Adicione até 3 categorias no mesmo perfil.</p>
      </div>
      {isOther && (
        <div>
          <label className="label" htmlFor="custom_category">Qual categoria?</label>
          <input id="custom_category" name="custom_category" required minLength={2} maxLength={40} className="input" placeholder="Ex.: Dedetização, Fotógrafo, Costureira…" />
          <p className="mt-1 text-xs text-navy/60">A indicação já fica publicada em “Outros”. Se várias pessoas pedirem, a administração pode criar uma categoria própria.</p>
        </div>
      )}
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
      <div>
        <label className="label" htmlFor="whatsapp">WhatsApp</label>
        <input id="whatsapp" name="whatsapp" required inputMode="tel" className="input" placeholder="(11) 99999-8888" />
      </div>
      <div>
        <label className="label" htmlFor="description">Descrição (opcional)</label>
        <textarea id="description" name="description" rows={3} maxLength={500} className="input" placeholder="O que ele faz, horários, diferenciais…" />
      </div>
      <PhotoField userId={userId} onBusyChange={setUploading} />
      <label className="flex items-start gap-2 rounded-2xl bg-sky-soft p-3 text-sm">
        <input type="checkbox" name="is_me" className="mt-1 h-4 w-4" />
        <span><b>Este profissional sou eu.</b> Vou pedir à administração para confirmar que o perfil é meu (aparece um selo “perfil confirmado”).</span>
      </label>
      <p className="text-xs text-navy/60">
        Ao indicar, você confirma que tem autorização para divulgar o contato deste profissional. Evite incluir dados pessoais além do WhatsApp.
      </p>
      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending || uploading || categoryIds.length === 0} className="btn w-full">{pending ? "Publicando…" : "Publicar indicação"}</button>
    </form>
  );
}
