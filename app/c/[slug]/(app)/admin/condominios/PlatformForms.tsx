"use client";
import { useActionState } from "react";
import { platformAddAdminByEmail, platformCreateCondo, platformSaveRegion, platformUpdateCondo } from "../../../actions";
import type { FormState } from "@/lib/types";

export type RegionOpt = { id: string; name: string };

function Feedback({ state }: { state: FormState }) {
  return (
    <>
      {state?.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-green-700">{state.ok}</p>}
    </>
  );
}

function RegionSelect({ id, regions, value }: { id: string; regions: RegionOpt[]; value?: string | null }) {
  return (
    <select id={id} name="region_id" defaultValue={value ?? ""} className="input !py-2">
      <option value="">Sem região (não compartilha prestadores)</option>
      {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  );
}

export function NewCondoForm({ slug, regions }: { slug: string; regions: RegionOpt[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(platformCreateCondo.bind(null, slug), undefined);
  return (
    <form action={action} className="space-y-2">
      <div>
        <label className="label !text-xs" htmlFor="nc-name">Nome do condomínio</label>
        <input id="nc-name" name="name" required minLength={2} maxLength={80} className="input !py-2" placeholder="Ex.: Condomínio Vila Verde" />
      </div>
      <div>
        <label className="label !text-xs" htmlFor="nc-slug">Endereço (link)</label>
        <div className="flex items-center gap-1 text-sm"><span className="text-navy/55">/c/</span>
          <input id="nc-slug" name="slug" required minLength={3} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input !py-2" placeholder="vila-verde" />
        </div>
        <p className="mt-1 text-xs text-navy/55">Letras minúsculas, números e hífen. Não muda depois: é o link que os moradores guardam.</p>
      </div>
      <div>
        <label className="label !text-xs" htmlFor="nc-region">Região</label>
        <RegionSelect id="nc-region" regions={regions} />
      </div>
      <Feedback state={state} />
      <button disabled={pending} className="btn !px-4 !py-2 !text-sm">{pending ? "Criando…" : "Criar condomínio"}</button>
    </form>
  );
}

export function EditCondoForm({
  slug, condo, regions,
}: {
  slug: string;
  condo: { id: string; name: string; region_id: string | null; is_active: boolean };
  regions: RegionOpt[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(platformUpdateCondo.bind(null, slug, condo.id), undefined);
  const k = `ec-${condo.id}`;
  return (
    <form action={action} className="space-y-2">
      <div>
        <label className="label !text-xs" htmlFor={`${k}-name`}>Nome</label>
        <input id={`${k}-name`} name="name" required minLength={2} maxLength={80} defaultValue={condo.name} className="input !py-2" />
      </div>
      <div>
        <label className="label !text-xs" htmlFor={`${k}-region`}>Região</label>
        <RegionSelect id={`${k}-region`} regions={regions} value={condo.region_id} />
        <p className="mt-1 text-xs text-navy/55">Condomínios da mesma região compartilham prestadores e avaliações. Moradores e administração continuam separados.</p>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={condo.is_active} className="h-5 w-5" />
        Condomínio ativo (desmarcado, os moradores não conseguem entrar)
      </label>
      <Feedback state={state} />
      <button disabled={pending} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : "Salvar"}</button>
    </form>
  );
}

export function RegionForm({ slug, region }: { slug: string; region?: RegionOpt & { slug: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(platformSaveRegion.bind(null, slug, region?.id ?? null), undefined);
  const k = region ? `rg-${region.id}` : "rg-novo";
  return (
    <form action={action} className="space-y-2">
      <div>
        <label className="label !text-xs" htmlFor={`${k}-name`}>Nome da região</label>
        <input id={`${k}-name`} name="name" required minLength={2} maxLength={80} defaultValue={region?.name} className="input !py-2" placeholder="Ex.: Parque Barueri e vizinhança" />
      </div>
      {!region && (
        <div>
          <label className="label !text-xs" htmlFor={`${k}-slug`}>Identificador</label>
          <input id={`${k}-slug`} name="slug" required minLength={3} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input !py-2" placeholder="parque-barueri" />
        </div>
      )}
      <Feedback state={state} />
      <button disabled={pending} className="btn !px-4 !py-2 !text-sm">{pending ? "Salvando…" : region ? "Salvar" : "Criar região"}</button>
    </form>
  );
}

export function AddAdminByEmailForm({ slug, condoId }: { slug: string; condoId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(platformAddAdminByEmail.bind(null, slug, condoId), undefined);
  return (
    <form action={action} className="space-y-2">
      <label className="label !text-xs" htmlFor={`ae-${condoId}`}>Adicionar por e-mail</label>
      <div className="flex gap-2">
        <input id={`ae-${condoId}`} name="email" type="email" required className="input !py-2" placeholder="pessoa@email.com" />
        <button disabled={pending} className="btn-secondary !px-3 !py-2 !text-sm">{pending ? "…" : "Adicionar"}</button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
