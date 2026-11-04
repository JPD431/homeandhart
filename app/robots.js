import { SITE_URL } from "@/app/lib/seo";

// Zonas privadas/API. Las demás rutas con sesión se excluyen con noindex
// (cabecera X-Robots-Tag en proxy.ts), que el rastreador debe poder leer.
const PRIVATE = ["/admin", "/dashboard", "/chat"];

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE, ...PRIVATE.map((p) => `/en${p}`), "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
