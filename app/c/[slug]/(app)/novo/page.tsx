import Link from "next/link";
import { requireMember } from "@/lib/condo";
import type { Category, CategoryGroup } from "@/lib/types";
import { groupCategories } from "@/lib/groups";
import { ProviderForm } from "./ProviderForm";

export default async function Novo({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ eu?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { user, member, supabase } = await requireMember(slug);
  const [{ data }, { data: groupData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort"),
    supabase.from("category_groups").select("id,slug,name,icon").order("sort"),
  ]);
  const sections = groupCategories((groupData ?? []) as CategoryGroup[], (data ?? []) as Category[]);
  return (
    <div className="space-y-4">
      <Link href={`/c/${slug}`} className="text-sm text-navy/60">← Voltar</Link>
      <h1 className="text-xl font-bold">Cadastrar um prestador</h1>
      <ProviderForm slug={slug} sections={sections} userId={user.id} defaultBlock={member.block} defaultName={member.full_name} initialMode={sp.eu ? "self" : "other"} />
    </div>
  );
}
