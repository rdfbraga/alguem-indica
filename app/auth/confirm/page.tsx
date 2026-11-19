import { Logo } from "@/components/Logo";
import { safeNext } from "@/lib/condo";
import { parseOtpType, parseTokenHash } from "@/lib/auth-link";

export const metadata = { title: "Confirmar acesso — Alguém indica?", robots: { index: false } };

export default async function ConfirmarAcesso({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const token_hash = parseTokenHash(sp.token_hash);
  const type = parseOtpType(sp.type);
  const next = safeNext(sp.next, "/");
  const valid = Boolean(token_hash && type);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 text-center">
      <Logo size="lg" />
      {valid ? (
        <form action="/auth/verify" method="post" className="card space-y-4">
          <h1 className="text-xl font-extrabold">Tudo certo! 🔑</h1>
          <p className="muted">Toque no botão para entrar no Alguém indica?.</p>
          <input type="hidden" name="token_hash" value={token_hash!} />
          <input type="hidden" name="type" value={type!} />
          <input type="hidden" name="next" value={next} />
          <button className="btn w-full">Entrar</button>
        </form>
      ) : (
        <div className="card space-y-2">
          <h1 className="text-xl font-extrabold">Link inválido</h1>
          <p className="muted">Esse link está incompleto ou já foi usado. Volte ao link do seu condomínio e peça um novo.</p>
        </div>
      )}
    </main>
  );
}
