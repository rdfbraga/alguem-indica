/** Normaliza um telefone brasileiro para o formato 55DDDNUMERO (só dígitos). Retorna null se inválido. */
export function normalizeWhatsapp(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!/^55\d{10,11}$/.test(d)) return null;
  const ddd = Number(d.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  // Celular (11 dígitos) deve começar com 9 após o DDD.
  if (d.length === 13 && d[4] !== "9") return null;
  return d;
}

export function formatWhatsapp(n: string): string {
  const ddd = n.slice(2, 4);
  const rest = n.slice(4);
  const cut = rest.length === 9 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
}

export function whatsappLink(n: string, text: string): string {
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
