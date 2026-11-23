import { notFound, redirect } from "next/navigation";
import { getCondo, getUser } from "@/lib/condo";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { withNext } from "@/lib/next-path";
import { claimFromLink } from "../../actions";
import { AssumirForm } from "./AssumirForm";

export const metadata = { title: "Assumir meu perfil" };

type Preview = { name: string; category_name: string; category_icon: string; condo_name: string; has_owner: boolean };

/** Link enviado ao profissional que um vizinho indicou: ele entra e pede para assumir o perfil (a administração confirma). */
export default async function Assumir({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const condo = await getCondo(slug);
  const user = await getUser();
  if (!user) redirect(withNext(`/c/${slug}/entrar`, slug, `/c/${slug}/assumir/${id}`));

  const supabase = await createClient();
  const { data } = await supabase.rpc("claim_preview", { p_provider: id });
  const prev = (Array.isArray(data) ? data[0] : null) as Preview | null;
  if (!prev) notFound();

  const { data: member } = await supabase.from("members").select("role,full_name").eq("condo_id", condo.id).eq("user_id", user.id).maybeSingle();
  const defaultName = (member?.full_name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <header className="space-y-3 text-center">
        <Logo size="lg" />
        <p className="rounded-full bg-sky-soft px-4 py-1.5 text-sm font-semibold text-sky-brand">🏠 {condo.name}</p>
      </header>
      <section className="card space-y-2 text-center">
        <p className="text-sm text-navy/65">Um vizinho indicou este perfil:</p>
        <p className="text-xl font-extrabold">{prev.category_icon} {prev.name}</p>
        <p className="text-sm text-navy/65">{prev.category_name}</p>
      </section>
      {prev.has_owner ? (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Este perfil já foi assumido. Se há algum engano, fale com a administração do condomínio.</p>
      ) : (
        <section className="space-y-3">
          <h1 className="text-lg font-extrabold">Este perfil é seu?</h1>
          <p className="text-sm text-navy/70">Ao assumir, você edita a foto e a descrição, vê quantas pessoas viram o perfil e recebe as avaliações dos vizinhos. A administração confirma que é você, e o acesso é só ao seu perfil.</p>
          {member?.role === "resident" || member?.role === "admin" ? (
            <form action={claimFromLink.bind(null, slug, id)}>
              <button className="btn w-full">Pedir para assumir este perfil</button>
            </form>
          ) : (
            <AssumirForm slug={slug} providerId={id} defaultName={defaultName} />
          )}
        </section>
      )}
    </main>
  );
}
