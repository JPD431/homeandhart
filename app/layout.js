import { Geist, Geist_Mono } from "next/font/google";
import AppProviders from "@/app/components/AppProviders";
import CookieBanner from "@/app/components/CookieBanner";
import InstallPWA from "@/app/components/InstallPWA";
import LegalConsentGate from "@/app/components/LegalConsentGate";
import "./globals.css";

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

export const metadata = {
  metadataBase: new URL("https://homeandheart.es"),
  title: {
    default:
      "Home&Heart · Alojamiento, niñera y mascotas en un solo lugar",
    template: "%s · Home&Heart",
  },
  description:
    "Alojamiento, niñeras y cuidadores de mascotas con documentación revisada por nuestro equipo. Todo coordinado, un solo pago protegido. Garantía de 30 minutos.",
  keywords: [
    "niñera Madrid",
    "cuidador mascotas Madrid",
    "alojamiento pet-friendly Madrid",
    "marketplace familias España",
  ],
  authors: [{ name: "Home&Heart" }],
  creator: "Home&Heart",
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://homeandheart.es",
    siteName: "Home&Heart",
    title:
      "Home&Heart · Alojamiento, niñera y mascotas en un solo lugar",
    description:
      "Alojamiento, niñeras y cuidadores de mascotas con documentación revisada por nuestro equipo. Todo coordinado, un solo pago protegido.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Home&Heart",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Home&Heart · Alojamiento, niñera y mascotas en un solo lugar",
    description:
      "Alojamiento, niñeras y cuidadores de mascotas con documentación revisada por nuestro equipo.",
    images: ["/og-image.png"],
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
    title: "Home&Heart",
  },
  formatDetection: {
    telephone: false,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
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
        <AppProviders>
          {children}
          <LegalConsentGate />
          <CookieBanner />
          <InstallPWA />
        </AppProviders>
      </body>
    </html>
  );
}
