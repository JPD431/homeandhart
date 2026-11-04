import { CIUDADES_INDEXABLES, VERTICALES_LANDING } from "@/app/lib/landing-routes";
import { LEGAL_DOCS_VERSION, LEGAL_FINAL } from "@/app/lib/legal-versions";
import { pageUrl } from "@/app/lib/seo";
import { getPublicSupabase } from "@/app/lib/supabase-public";

/**
 * Sitemap = solo URLs indexables que devuelven 200 (sin login/registro/ser-proveedor,
 * ni rutas con sesión, ni landings de ciudades sin cobertura).
 *
 * lastModified de las páginas estáticas: fecha del último cambio REAL de su contenido.
 * Actualiza el valor al editar el contenido de la página (no es la fecha de build).
 */
const LEGAL_LASTMOD = `${LEGAL_DOCS_VERSION}-01`;

const STATIC_PAGES = [
  { path: "/", lastModified: "2026-10-19", changeFrequency: "weekly", priority: 1 },
  { path: "/buscar", lastModified: "2026-07-31", changeFrequency: "daily", priority: 0.9 },
  { path: "/garantia", lastModified: "2026-08-09", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nuestra-historia", lastModified: "2026-07-13", changeFrequency: "monthly", priority: 0.6 },
  { path: "/blog", lastModified: "2026-10-15", changeFrequency: "weekly", priority: 0.7 },
  { path: "/legal/terminos", lastModified: LEGAL_LASTMOD, changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/privacidad", lastModified: LEGAL_LASTMOD, changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/cookies", lastModified: LEGAL_LASTMOD, changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/aviso", lastModified: LEGAL_LASTMOD, changeFrequency: "yearly", priority: 0.3 },
];

const LANDING_LASTMOD = "2026-10-16";

/** Una entrada por idioma, con hreflang cruzado. */
function bilingualEntries({ path, lastModified, changeFrequency, priority }) {
  const languages = {
    es: pageUrl(path, "es"),
    en: pageUrl(path, "en"),
    "x-default": pageUrl(path, "es"),
  };
  return ["es", "en"].map((lang) => ({
    url: pageUrl(path, lang),
    lastModified: new Date(lastModified),
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap() {
  // Blog: solo con artículos publicados. Legales de relleno: fuera hasta LEGAL_FINAL.
  let hasPosts = false;
  const isLegalPlaceholder = (path) =>
    !LEGAL_FINAL && ["/legal/terminos", "/legal/privacidad", "/legal/aviso"].includes(path);

  const landingEntries = CIUDADES_INDEXABLES.flatMap((ciudad) =>
    VERTICALES_LANDING.flatMap((vertical) =>
      bilingualEntries({
        path: `/${ciudad}/${vertical}`,
        lastModified: LANDING_LASTMOD,
        changeFrequency: "weekly",
        priority: 0.85,
      }),
    ),
  );

  let proveedorEntries = [];
  let blogEntries = [];
  try {
    const supabase = getPublicSupabase();

    const { data: proveedores, error } = await supabase
      .from("profiles_public")
      .select("id, fecha_registro")
      .eq("role", "proveedor")
      .eq("verificado", true)
      .limit(2000);

    if (error) {
      console.error("[sitemap] Error cargando proveedores:", error.message);
    } else {
      proveedorEntries = (proveedores || [])
        .filter((p) => p.fecha_registro)
        .flatMap((p) =>
          bilingualEntries({
            path: `/proveedor/${p.id}`,
            lastModified: p.fecha_registro,
            changeFrequency: "weekly",
            priority: 0.8,
          }),
        );
    }

    // Artículos: solo versión ES (el contenido aún no está traducido).
    const { data: posts, error: postsError } = await supabase
      .from("blog_posts")
      .select("slug, created_at")
      .eq("publicado", true)
      .limit(2000);

    if (postsError) {
      console.error("[sitemap] Error cargando blog:", postsError.message);
    } else {
      hasPosts = (posts || []).length > 0;
      blogEntries = (posts || []).map((post) => ({
        url: pageUrl(`/blog/${post.slug}`, "es"),
        lastModified: new Date(post.created_at),
        changeFrequency: "monthly",
        priority: 0.6,
      }));
    }
  } catch (err) {
    console.error(
      "[sitemap] Fallo cliente público; sitemap mínimo:",
      err?.message || err,
    );
  }

  const staticEntries = STATIC_PAGES.filter(
    (page) => !isLegalPlaceholder(page.path) && (page.path !== "/blog" || hasPosts),
  ).flatMap(bilingualEntries);

  return [...staticEntries, ...landingEntries, ...proveedorEntries, ...blogEntries];
}
