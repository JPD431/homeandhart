import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Compat legacy: /anuncio/[id]?preview=1 → ruta dinámica con sesión.
  // Fuera del Server Component ISR para no tocar searchParams allí.
  const { pathname, searchParams } = request.nextUrl;
  const anuncioMatch = pathname.match(/^\/anuncio\/([^/]+)\/?$/);
  if (anuncioMatch && searchParams.get("preview") === "1") {
    const url = request.nextUrl.clone();
    url.pathname = `/anuncio/${anuncioMatch[1]}/preview`;
    url.searchParams.delete("preview");
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
