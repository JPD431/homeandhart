import Hero from "./components/Hero";
import ProblemSection from "./components/ProblemSection";
import EcosystemSection from "./components/EcosystemSection";
import TrustSection from "./components/TrustSection";
import CheckoutSection from "./components/CheckoutSection";
import RetentionSection from "./components/RetentionSection";
import DoubleCTASection from "./components/DoubleCTASection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <ProblemSection />
      <EcosystemSection />
      <TrustSection />
      <CheckoutSection />
      <RetentionSection />
      <DoubleCTASection />
      <Footer />
    </main>
  );
}
