import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova o token de sessão do Supabase a cada requisição.
export async function proxy(request: NextRequest) {
  // Guarda o caminho pedido para as páginas protegidas saberem para onde voltar depois do login.
  // Sempre sobrescreve: um valor enviado pelo navegador nunca é usado. (Precisa ser encaminhado pela resposta.)
  const path = request.nextUrl.pathname + request.nextUrl.search;
  const forward = () => {
    const h = new Headers(request.headers);
    h.set("x-next-path", path);
    return h;
  };
  let response = NextResponse.next({ request: { headers: forward() } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: forward() } });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)"],
};
