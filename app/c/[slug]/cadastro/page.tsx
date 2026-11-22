import { redirect } from "next/navigation";
import { getCondo, getUser } from "@/lib/condo";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";
import { condoNext, withNext } from "@/lib/next-path";
import { parseCondoKind } from "@/lib/condo-kind";

export default async function Cadastro({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { slug } = await params;
  const next = condoNext(slug, (await searchParams).next);
  const condo = await getCondo(slug);
  const user = await getUser();
  if (!user) redirect(withNext(`/c/${slug}/entrar`, slug, next));
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members").select("user_id").eq("condo_id", condo.id).eq("user_id", user.id).maybeSingle();
  if (member) redirect(next);
  const defaultName = (user.user_metadata?.full_name as string | undefined) ?? "";
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Quase lá! 👋</h1>
        <p className="muted">Complete seu cadastro em <b>{condo.name}</b>.</p>
      </header>
      <OnboardingForm slug={slug} defaultName={defaultName} next={next} kind={parseCondoKind(condo.kind)} />
    </main>
  );
}
