import { Geist, Geist_Mono } from "next/font/google";
import CookieBanner from "@/app/components/CookieBanner";
import { LangProvider } from "@/app/lib/LangContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://homeandheart.es"),
  title: {
    default:
      "Home&Heart · Alojamiento, niñera y mascotas en un solo lugar",
    template: "%s · Home&Heart",
  },
  description:
    "Encuentra alojamiento verificado, niñeras certificadas y cuidadores de mascotas. Todo coordinado, un solo pago protegido. Garantía de 30 minutos.",
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
      "Encuentra alojamiento verificado, niñeras certificadas y cuidadores de mascotas. Todo coordinado, un solo pago protegido.",
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
      "Encuentra alojamiento verificado, niñeras certificadas y cuidadores de mascotas.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LangProvider>
          {children}
          <CookieBanner />
        </LangProvider>
      </body>
    </html>
  );
}
