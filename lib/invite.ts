import { bareCondoName } from "./contact.ts";

/**
 * Mensagem do convite entre vizinhos (vai preenchida no compartilhamento do celular; a pessoa pode editar).
 * Só o primeiro nome e o nome do condomínio. O link fica em linha própria para o WhatsApp mostrar a prévia.
 */
export function buildInviteMessage(args: { residentName?: string | null; condoName: string; url: string }): string {
  const first = (args.residentName ?? "").trim().split(/\s+/)[0];
  const condo = bareCondoName(args.condoName);
  const who = first ? `Aqui é ${first}. ` : "";
  return (
    `Oi, vizinhos! 👋 ${who}Estou usando o *Alguém indica?* para achar prestadores que os moradores do ${condo} já aprovaram: ` +
    `eletricista, diarista, médico, o que precisar. É grátis.\n\nEntra por aqui:\n${args.url}\n\n` +
    `Se você conhece um bom profissional, indica lá também. Ajuda todo mundo. 🙏`
  );
}

export function inviteWhatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Convite para grupos com moradores de VÁRIOS condomínios: o link leva à página em que cada um escolhe o seu. */
export function buildRegionInviteMessage(args: { residentName?: string | null; regionName: string; url: string }): string {
  const first = (args.residentName ?? "").trim().split(/\s+/)[0];
  const who = first ? `Aqui é ${first}. ` : "";
  return (
    `Oi, vizinhos! 👋 ${who}Estou usando o *Alguém indica?* para achar prestadores que os moradores dos condomínios da nossa região já aprovaram: ` +
    `eletricista, diarista, médico, o que precisar. É grátis.\n\nEscolha o seu condomínio e entre por aqui:\n${args.url}\n\n` +
    `Se você conhece um bom profissional, indica lá também. Ajuda todo mundo. 🙏`
  );
}
