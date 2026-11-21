"use client";
import { useId, useRef, useState } from "react";
import { suggest } from "@/lib/search-suggest";

/** Campo de busca com sugestões (categorias e especialidades) que aparecem enquanto a pessoa digita. Funciona em qualquer celular. */
export function SearchBox({ slug, q, suggestions }: { slug: string; q: string; suggestions: string[] }) {
  const [value, setValue] = useState(q);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const listId = useId();
  const items = open ? suggest(suggestions, value) : [];

  function pick(s: string) {
    setValue(s);
    setOpen(false);
    setActive(-1);
    // o valor chega ao campo antes de enviar
    queueMicrotask(() => formRef.current?.requestSubmit());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && items.length) { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0 && items[active]) { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
  }

  return (
    <form ref={formRef} action={`/c/${slug}`} className="relative flex gap-2" role="search">
      <div className="relative min-w-0 flex-1">
        <input
          name="q"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Buscar: encanador, diarista, personal…"
          className="input"
          autoComplete="off"
          autoCapitalize="none"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        />
        {items.length > 0 && (
          <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-2xl border border-navy/10 bg-white py-1 shadow-lg">
            {items.map((s, i) => (
              <li
                key={s}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // pointerdown dispara antes do campo perder o foco; assim o toque no celular não se perde
                onPointerDown={(e) => { e.preventDefault(); pick(s); }}
                className={`cursor-pointer px-4 py-2.5 text-sm font-semibold ${i === active ? "bg-brand-50 text-brand-700" : "text-navy"}`}
              >
                🔍 {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="btn !px-4" aria-label="Buscar">🔍</button>
    </form>
  );
}
