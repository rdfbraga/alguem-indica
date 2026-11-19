/** De onde veio o perfil: confirmado pelo próprio dono, cadastrado pelo próprio (aguardando confirmação) ou indicado por vizinho. */
export type Origin = "confirmed" | "self_pending" | "neighbor";

export function profileOrigin(p: { owner_id?: string | null; self_pending?: boolean | null }): Origin {
  if (p.owner_id) return "confirmed";
  return p.self_pending ? "self_pending" : "neighbor";
}

/** Mensagem pronta para o prestador mandar aos vizinhos pedindo avaliação. */
export function shareProfileText(args: { name: string; categories: string[]; url: string }): string {
  const what = args.categories.length ? ` (${args.categories.slice(0, 2).join(" / ")})` : "";
  return `Oi, vizinhos! Divulguei meu serviço${what} no Alguém indica?, a rede de confiança do nosso condomínio. Se você já usou meu trabalho, deixa sua avaliação aqui: ${args.url}`;
}

export function shareProfileLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
