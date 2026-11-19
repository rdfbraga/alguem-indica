import { redirect } from "next/navigation";
import { getCondo, getUser } from "@/lib/condo";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function Cadastro({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const condo = await getCondo(slug);
  const user = await getUser();
  if (!user) redirect(`/c/${slug}/entrar`);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members").select("user_id").eq("condo_id", condo.id).eq("user_id", user.id).maybeSingle();
  if (member) redirect(`/c/${slug}`);
  const defaultName = (user.user_metadata?.full_name as string | undefined) ?? "";
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Quase lá! 👋</h1>
        <p className="text-stone-600">Complete seu cadastro em <b>{condo.name}</b>.</p>
      </header>
      <OnboardingForm slug={slug} defaultName={defaultName} />
    </main>
  );
}
