/** Campo de busca com sugestões nativas (datalist) de categorias enquanto digita. */
export function SearchBox({ slug, q, suggestions }: { slug: string; q: string; suggestions: string[] }) {
  return (
    <form action={`/c/${slug}`} className="flex gap-2" role="search">
      <input
        name="q"
        defaultValue={q}
        list="sugestoes-categorias"
        placeholder="Buscar: encanador, diarista, personal…"
        className="input"
        autoComplete="off"
        enterKeyHint="search"
      />
      <datalist id="sugestoes-categorias">
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
      <button className="btn !px-4" aria-label="Buscar">🔍</button>
    </form>
  );
}
