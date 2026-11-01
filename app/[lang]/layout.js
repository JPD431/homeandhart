import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import AppProviders from "@/app/components/AppProviders";
import CookieBanner from "@/app/components/CookieBanner";
import InstallPWA from "@/app/components/InstallPWA";
import LegalConsentGate from "@/app/components/LegalConsentGate";
import { LOCALES, isLocale } from "@/app/lib/locale";
import {
  DEFAULT_OG_IMAGE,
  PAGE_COPY,
  SITE_NAME,
  SITE_URL,
  resolveLang,
} from "@/app/lib/seo";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4f91",
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

/**
 * Metadatos comunes. Cada página añade su title/description/canonical/og con
 * buildPageMetadata (app/lib/seo.js); title.template evita duplicar el nombre.
 */
export async function generateMetadata({ params }) {
  const lang = await resolveLang(params);
  const home = PAGE_COPY.home[lang];

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: home.title, template: `%s · ${SITE_NAME}` },
    description: home.description,
    keywords: [
      "niñera Madrid",
      "cuidador mascotas Madrid",
      "alojamiento pet-friendly Madrid",
      "marketplace familias España",
    ],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: lang === "en" ? "en_GB" : "es_ES",
      title: home.title,
      description: home.description,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: home.title,
      description: home.description,
      images: [DEFAULT_OG_IMAGE.url],
    },
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
      apple: "/favicon.png",
      other: {
        rel: "icon",
        url: "/favicon.png",
      },
    },
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: SITE_NAME,
    },
    formatDetection: {
      telephone: false,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children, params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1d4f91" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Home&Heart" />
      </head>
      <body className="min-h-full flex flex-col">
        <AppProviders lang={lang}>
          {children}
          <LegalConsentGate />
          <CookieBanner />
          <InstallPWA />
        </AppProviders>
      </body>
    </html>
  );
}
