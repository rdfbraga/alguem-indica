/** De onde veio o perfil: confirmado pelo próprio dono, cadastrado pelo próprio (aguardando confirmação) ou indicado por vizinho. */
export type Origin = "confirmed" | "self_pending" | "neighbor";

export function profileOrigin(p: { owner_id?: string | null; self_pending?: boolean | null }): Origin {
  if (p.owner_id) return "confirmed";
  return p.self_pending ? "self_pending" : "neighbor";
}

/**
 * Mensagem pronta para o prestador mandar aos vizinhos (grupo ou conversa), pedindo uma avaliação.
 * Em primeira pessoa e sem nome: o WhatsApp já mostra quem enviou. O link vai em uma linha própria.
 */
export function shareProfileText(args: { categories: string[]; url: string }): string {
  const cats = args.categories.slice(0, 2).join(" e ");
  const profile = cats ? `Meu perfil de *${cats}*` : "Meu perfil";
  return `Oi, vizinhos! 👋 ${profile} já está no Alguém indica?, o app de indicações do nosso condomínio.\n\nSe você já usou meu trabalho, me ajuda com uma avaliação? Leva 1 minuto:\n${args.url}\n\nValeu, vizinhos! 🙏`;
}

export function shareProfileLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
