import { LEGAL_FINAL } from "@/app/lib/legal-versions";
import { DEFAULT_LOCALE, LOCALES, isLocale, localizeHref } from "@/app/lib/locale";

/** URL pública del sitio (sin barra final). Configurable con NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://homeandheart.es"
).replace(/\/+$/, "");

export const SITE_NAME = "Home&Heart";
export const DEFAULT_OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: SITE_NAME,
};

const OG_LOCALE = { es: "es_ES", en: "en_GB" };

/** Lee y valida [lang] de los params de una ruta. */
export async function resolveLang(params) {
  const { lang } = (await params) ?? {};
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

/** URL absoluta de una ruta interna en un idioma ("/buscar", "en" -> https://.../en/buscar). */
export function pageUrl(path, lang = DEFAULT_LOCALE) {
  const localized = localizeHref(path, lang);
  return `${SITE_URL}${localized === "/" ? "" : localized}` || SITE_URL;
}

/**
 * canonical autorreferenciado + hreflang (es, en, x-default).
 * `translated: false` => la versión EN todavía no está traducida: no se anuncia hreflang.
 */
export function buildAlternates(path, lang, { translated = true } = {}) {
  const alternates = { canonical: pageUrl(path, lang) };
  if (translated) {
    alternates.languages = {
      es: pageUrl(path, "es"),
      en: pageUrl(path, "en"),
      "x-default": pageUrl(path, "es"),
    };
  }
  return alternates;
}

/**
 * Metadatos completos de una página indexable (o noindex si se indica).
 * `title` va SIN el sufijo " · Home&Heart" (lo añade title.template del layout raíz).
 */
export function buildPageMetadata({
  lang,
  path,
  title,
  description,
  noindex = false,
  translated = true,
  absoluteTitle = false,
  image,
  type = "website",
}) {
  const url = pageUrl(path, lang);
  const ogTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  const images = image ? [{ url: image }] : [DEFAULT_OG_IMAGE];
  // EN sin traducir: no se indexa hasta que exista el contenido.
  const blockIndex = noindex || (!translated && lang !== DEFAULT_LOCALE);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: buildAlternates(path, lang, { translated: translated && !noindex }),
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: OG_LOCALE[lang] ?? OG_LOCALE.es,
      url,
      title: ogTitle,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: images.map((i) => i.url),
    },
    robots: blockIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

/** Textos SEO de las páginas estáticas (≤ ~47 caracteres de título, ≤ 155 de descripción). */
export const PAGE_COPY = {
  home: {
    es: {
      title: "Home&Heart · Alojamiento, niñera y mascotas en un solo lugar",
      description:
        "Alojamiento, niñeras y cuidadores de mascotas con documentación revisada por nuestro equipo. Un solo pago protegido y garantía de sustitución.",
    },
    en: {
      title: "Home&Heart · Stays, childcare and pet care in one place",
      description:
        "Accommodation, nannies and pet carers with documentation reviewed by our team. One protected payment and a replacement guarantee.",
    },
  },
  buscar: {
    es: {
      title: "Buscar proveedores verificados",
      description:
        "Encuentra niñeras, alojamiento pet-friendly y cuidadores de mascotas con documentación revisada cerca de ti.",
    },
    en: {
      title: "Find verified providers",
      description:
        "Find nannies, pet-friendly accommodation and pet carers with reviewed documentation near you.",
    },
  },
  garantia: {
    es: {
      title: "Garantía de sustitución si tu proveedor cancela",
      description:
        "Si tu proveedor cancela con menos de 24h, buscamos una alternativa verificada lo antes posible (nuestro objetivo: 30 minutos).",
    },
    en: {
      title: "Replacement guarantee if your provider cancels",
      description:
        "If your provider cancels with less than 24h notice, we look for a verified alternative as soon as possible (our goal: 30 minutes).",
    },
  },
  historia: {
    es: {
      title: "Nuestra historia",
      description:
        "La historia detrás de Home&Heart: una familia construyendo una red de confianza real para viajar y cuidar con tranquilidad.",
    },
    en: {
      title: "Our story",
      description:
        "The story behind Home&Heart: a family building a real network of trust to travel and care with peace of mind.",
    },
  },
  blog: {
    es: {
      title: "Blog para familias viajeras",
      description:
        "Consejos y guías para familias: alojamiento, cuidado de niños, mascotas y viajes con tranquilidad.",
    },
    en: {
      title: "Blog for travelling families",
      description:
        "Tips and guides for families: accommodation, childcare, pets and travelling with peace of mind.",
    },
  },
  ayuda: {
    es: {
      title: "Ayuda y soporte",
      description:
        "Contacta con el equipo de Home&Heart para dudas de cuenta, activación o pagos.",
    },
    en: {
      title: "Help and support",
      description:
        "Contact the Home&Heart team for account, activation or payment questions.",
    },
  },
  login: {
    es: {
      title: "Iniciar sesión",
      description: "Accede a tu cuenta de Home&Heart para gestionar tus reservas y mensajes.",
    },
    en: {
      title: "Log in",
      description: "Log in to your Home&Heart account to manage your bookings and messages.",
    },
  },
  registro: {
    es: {
      title: "Crear cuenta",
      description: "Crea tu cuenta de Home&Heart para reservar alojamiento, niñeras y cuidadores de mascotas.",
    },
    en: {
      title: "Create account",
      description: "Create your Home&Heart account to book accommodation, nannies and pet carers.",
    },
  },
  recuperar: {
    es: {
      title: "Recuperar contraseña",
      description: "Te enviaremos un email para restablecer la contraseña de tu cuenta de Home&Heart.",
    },
    en: {
      title: "Reset password",
      description: "We will email you a link to reset your Home&Heart account password.",
    },
  },
  nuevaContrasena: {
    es: {
      title: "Nueva contraseña",
      description: "Elige una nueva contraseña para tu cuenta de Home&Heart.",
    },
    en: {
      title: "New password",
      description: "Choose a new password for your Home&Heart account.",
    },
  },
  serProveedor: {
    es: {
      title: "Hazte proveedor",
      description:
        "Únete a Home&Heart como niñera, anfitrión o cuidador de mascotas. Las 3 primeras reservas sin comisión.",
    },
    en: {
      title: "Become a provider",
      description:
        "Join Home&Heart as a nanny, host or pet carer. Your first 3 bookings are commission-free.",
    },
  },
  terminos: {
    es: {
      title: "Términos de uso",
      description: "Términos de uso de la plataforma Home&Heart (texto provisional pendiente de revisión legal).",
    },
    en: {
      title: "Terms of use",
      description: "Terms of use of the Home&Heart platform (provisional text pending legal review).",
    },
  },
  privacidad: {
    es: {
      title: "Política de privacidad",
      description: "Cómo trata Home&Heart tus datos personales (texto provisional pendiente de revisión legal).",
    },
    en: {
      title: "Privacy policy",
      description: "How Home&Heart handles your personal data (provisional text pending legal review).",
    },
  },
  cookies: {
    es: {
      title: "Política de cookies",
      description: "Qué cookies y almacenamiento del navegador usa Home&Heart y para qué.",
    },
    en: {
      title: "Cookie policy",
      description: "Which cookies and browser storage Home&Heart uses and why.",
    },
  },
  aviso: {
    es: {
      title: "Aviso legal",
      description: "Aviso legal e información identificativa de Home&Heart (texto provisional pendiente de revisión legal).",
    },
    en: {
      title: "Legal notice",
      description: "Legal notice and identification details of Home&Heart (provisional text pending legal review).",
    },
  },
};

/** Metadatos de una página estática a partir de PAGE_COPY. */
const LEGAL_PLACEHOLDER_KEYS = ["terminos", "privacidad", "aviso"];

export function staticPageMetadata(key, path, lang, options = {}) {
  const copy = PAGE_COPY[key][lang] ?? PAGE_COPY[key].es;
  const provisional = !LEGAL_FINAL && LEGAL_PLACEHOLDER_KEYS.includes(key);
  return buildPageMetadata({
    lang,
    path,
    title: copy.title,
    description: copy.description,
    absoluteTitle: key === "home",
    noindex: provisional,
    ...options,
  });
}

export { LOCALES };

/** JSON-LD de página (WebPage, AboutPage, Blog…) con los textos SEO de PAGE_COPY. */
export function pageSchema(key, path, lang, type = "WebPage") {
  const copy = PAGE_COPY[key][lang] ?? PAGE_COPY[key].es;
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: copy.title,
    description: copy.description,
    url: pageUrl(path, lang),
    inLanguage: lang,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
}
