import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/condo";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  const condoPath = next.startsWith("/c/") ? next.split("/").slice(0, 3).join("/") : "";
  return NextResponse.redirect(`${origin}${condoPath ? `${condoPath}/entrar?erro=1` : "/"}`);
}
