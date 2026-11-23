import { linkRequestProvider } from "../../actions";
import type { ProviderRow } from "@/lib/types";
import { providerCategoryLabels } from "@/lib/categories";

/**
 * "Esse profissional já está no app?": busca entre os prestadores da região. Tocar em "É este" liga o pedido ao perfil
 * (quem pediu é avisado) sem criar um cadastro repetido.
 */
export function ExistingProvider({
  slug, servico, cat, buscar, results, viewerCondoId, erro,
}: {
  slug: string; servico: string; cat?: string; buscar: string; results: ProviderRow[]; viewerCondoId: string; erro?: string;
}) {
  return (
    <section className="card space-y-3 !border-brand-500/40 !bg-brand-50/60">
      <div>
        <h2 className="font-extrabold">🔎 Esse profissional já está no app?</h2>
        <p className="text-sm text-navy/70">Procure pelo nome ou pelo WhatsApp. Se achar, toque em “É este” e quem procurava “{servico}” será avisado. Não precisa cadastrar de novo.</p>
      </div>
      {erro && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
          {erro === "limite" ? "Você já fez várias ligações hoje. Tente de novo amanhã." : "Não foi possível ligar esse perfil. Tente de novo."}
        </p>
      )}
      <form method="get" className="flex gap-2">
        <input type="hidden" name="servico" value={servico} />
        {cat && <input type="hidden" name="cat" value={cat} />}
        <input name="buscar" defaultValue={buscar} minLength={2} maxLength={60} className="input !py-2" placeholder="Nome ou WhatsApp" aria-label="Buscar profissional já cadastrado" />
        <button className="btn !px-4 !py-2 !text-sm">Buscar</button>
      </form>
      {buscar && results.length === 0 && <p className="text-sm text-navy/65">Ninguém encontrado com “{buscar}”. Preencha o cadastro abaixo.</p>}
      <ul className="space-y-2">
        {results.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3">
            <div className="min-w-0">
              <div className="truncate font-extrabold">{p.name}</div>
              <div className="truncate text-xs text-navy/60">
                {providerCategoryLabels(p).join(" · ")}{p.condo_id !== viewerCondoId && p.condo_name ? ` · 📍 ${p.condo_name}` : ""}
              </div>
            </div>
            <form action={linkRequestProvider.bind(null, slug, servico, p.id)}>
              <button className="btn !px-3 !py-2 !text-sm">É este</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
