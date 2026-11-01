import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LANG_COOKIE = "lang";

/** Zonas con sesión: no se indexan (además de Disallow en robots.txt). */
const PRIVATE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/chat",
  "/editar-perfil",
  "/estadisticas",
  "/familia",
  "/historial",
  "/pasaporte",
  "/completar-perfil",
  "/subir-dni",
  "/verificado",
  "/viaje",
  "/reserva",
  "/reservar",
  "/resena",
  "/confirmar-servicio",
  "/referencias",
  "/comparar",
];

function isPrivatePath(cleanPath: string) {
  return (
    PRIVATE_PREFIXES.some(
      (p) => cleanPath === p || cleanPath.startsWith(`${p}/`),
    ) || /^\/anuncio\/[^/]+\/preview\/?$/.test(cleanPath)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Idioma por URL: ES sin prefijo (se reescribe a /es/...), EN bajo /en.
  const prefix = pathname.match(/^\/(es|en)(?=\/|$)/)?.[1] ?? null;
  const cleanPath = prefix
    ? pathname.slice(prefix.length + 1) || "/"
    : pathname;

  // Compat legacy: /anuncio/[id]?preview=1 → ruta dinámica con sesión.
  // Fuera del Server Component ISR para no tocar searchParams allí.
  const anuncioMatch = cleanPath.match(/^\/anuncio\/([^/]+)\/?$/);
  if (anuncioMatch && searchParams.get("preview") === "1") {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix === "en" ? "/en" : ""}/anuncio/${anuncioMatch[1]}/preview`;
    url.searchParams.delete("preview");
    return NextResponse.redirect(url);
  }

  let rewriteTo: URL | null = null;
  if (!isApi) {
    if (prefix === "es") {
      // /es/... es la ruta interna: la URL pública de ES no lleva prefijo.
      const url = request.nextUrl.clone();
      url.pathname = cleanPath;
      return NextResponse.redirect(url, 308);
    }
    if (!prefix) {
      // Preferencia guardada (cookie): los rastreadores no la envían.
      if (
        request.method === "GET" &&
        request.cookies.get(LANG_COOKIE)?.value === "en"
      ) {
        const url = request.nextUrl.clone();
        url.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
        return NextResponse.redirect(url);
      }
      rewriteTo = request.nextUrl.clone();
      rewriteTo.pathname = pathname === "/" ? "/es" : `/es${pathname}`;
    }
  }

  const makeResponse = () =>
    rewriteTo
      ? NextResponse.rewrite(rewriteTo, { request })
      : NextResponse.next({ request });

  let supabaseResponse = makeResponse();

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
          supabaseResponse = makeResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  if (prefix === "en") {
    // Las navegaciones sin prefijo desde una página EN conservan el idioma.
    supabaseResponse.cookies.set(LANG_COOKIE, "en", {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  }

  if (isApi || isPrivatePath(cleanPath)) {
    supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|txt|xml|css|map|woff2?)$).*)",
  ],
};
