import { InviteButton } from "./InviteButton";
import { buildHelpRequestMessage } from "@/lib/invite";
import { SITE_URL } from "@/lib/site";

/**
 * "Pedir ajuda nos grupos": abre o compartilhamento do celular (ou o WhatsApp) com um texto pronto sobre o que a pessoa procura.
 * Ela escolhe para quem mandar. O link leva direto ao cadastro da indicação; com região, há também o link da região, para grupos de vários condomínios.
 */
export function HelpRequestButtons({
  slug, residentName, condoName, what, region,
}: {
  slug: string;
  residentName: string;
  condoName: string;
  what: string;
  region: { slug: string; name: string } | null;
}) {
  const condoUrl = `${SITE_URL}/c/${slug}/novo?servico=${encodeURIComponent(what.slice(0, 60))}`;
  const condoText = buildHelpRequestMessage({ residentName, condoName, what, url: condoUrl });
  if (!region) return <InviteButton url={condoUrl} text={condoText} label="📲 Pedir ajuda nos grupos" />;
  const regionUrl = `${SITE_URL}/r/${region.slug}`;
  const regionText = buildHelpRequestMessage({ residentName, condoName: region.name, what, url: regionUrl });
  return (
    <div className="space-y-2">
      <InviteButton url={condoUrl} text={condoText} label="📲 Pedir ajuda no grupo do condomínio" />
      <InviteButton url={regionUrl} text={regionText} label="📲 Pedir ajuda (vários condomínios)" />
    </div>
  );
}
