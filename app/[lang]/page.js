import Hero from "@/app/components/Hero";
import Navbar from "@/app/components/Navbar";
import ProblemSection from "@/app/components/ProblemSection";
import EcosystemSection from "@/app/components/EcosystemSection";
import TrustSection from "@/app/components/TrustSection";
import CheckoutSection from "@/app/components/CheckoutSection";
import RetentionSection from "@/app/components/RetentionSection";
import DoubleCTASection from "@/app/components/DoubleCTASection";
import Footer from "@/app/components/Footer";
import JsonLd from "@/app/components/JsonLd";
import { SITE_NAME, SITE_URL, resolveLang, staticPageMetadata } from "@/app/lib/seo";

export async function generateMetadata({ params }) {
  return staticPageMetadata("home", "/", await resolveLang(params));
}

// Solo datos verificables: sin valoraciones, precios ni cobertura.
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logoo1.png`,
};

// SearchAction: /buscar acepta ?ciudad=... (ver buscar/page.js).
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/buscar?ciudad={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <Navbar />
      <main id="contenido" tabIndex={-1} className="outline-none">
        <Hero />
        <ProblemSection />
        <EcosystemSection />
        <TrustSection />
        <CheckoutSection />
        <RetentionSection />
        <DoubleCTASection />
      </main>
      <Footer />
    </>
  );
}
