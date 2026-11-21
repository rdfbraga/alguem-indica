const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Sugestões enquanto a pessoa digita: ignora acento e maiúsculas e põe primeiro quem COMEÇA com o que foi digitado,
 * depois quem tem uma palavra começando com isso, depois quem contém. Sem repetição, no máximo `max`.
 */
export function suggest(options: string[], typed: string, max = 6): string[] {
  const q = norm(typed);
  if (q.length < 2) return [];
  const seen = new Set<string>();
  const scored: { s: string; rank: number }[] = [];
  for (const s of options) {
    const n = norm(s);
    if (seen.has(n)) continue;
    seen.add(n);
    let rank = -1;
    if (n.startsWith(q)) rank = 0;
    else if (n.split(/[\s/,-]+/).some((w) => w.startsWith(q))) rank = 1;
    else if (n.includes(q)) rank = 2;
    if (rank >= 0) scored.push({ s, rank });
  }
  return scored.sort((a, b) => a.rank - b.rank || a.s.localeCompare(b.s, "pt-BR")).slice(0, max).map((x) => x.s);
}
