import Link from "next/link";
import { requireMember } from "@/lib/condo";
import type { Category } from "@/lib/types";
import { ProviderForm } from "./ProviderForm";

export default async function Novo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, member, supabase } = await requireMember(slug);
  const { data } = await supabase.from("categories").select("*").order("sort");
  return (
    <div className="space-y-4">
      <Link href={`/c/${slug}`} className="text-sm text-stone-500">← Voltar</Link>
      <h1 className="text-xl font-bold">Indicar um profissional</h1>
      <ProviderForm slug={slug} categories={(data ?? []) as Category[]} userId={user.id} defaultBlock={member.block} />
    </div>
  );
}
