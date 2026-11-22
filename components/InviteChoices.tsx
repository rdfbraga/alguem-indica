import { InviteButton } from "./InviteButton";
import { buildInviteMessage, buildRegionInviteMessage } from "@/lib/invite";
import { SITE_URL } from "@/lib/site";

/**
 * Convite entre vizinhos. Se o condomínio está numa região, oferece dois textos: um para o grupo do próprio condomínio
 * e outro, com o link da região, para grupos que misturam moradores de vários condomínios.
 */
export function InviteChoices({
  slug, residentName, condoName, region,
}: {
  slug: string;
  residentName: string;
  condoName: string;
  region: { slug: string; name: string } | null;
}) {
  const condoUrl = `${SITE_URL}/c/${slug}`;
  const condoText = buildInviteMessage({ residentName, condoName, url: condoUrl });
  if (!region) return <InviteButton url={condoUrl} text={condoText} />;
  const regionUrl = `${SITE_URL}/r/${region.slug}`;
  const regionText = buildRegionInviteMessage({ residentName, regionName: region.name, url: regionUrl });
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-xs font-semibold text-navy/65">Grupo só do meu condomínio</div>
        <InviteButton url={condoUrl} text={condoText} label="📲 Convidar vizinhos" />
      </div>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-navy/65">Grupo com moradores de vários condomínios</div>
        <InviteButton url={regionUrl} text={regionText} label="📲 Convidar (link da região)" />
      </div>
    </div>
  );
}
