import Hero from "./components/Hero";
import ProblemSection from "./components/ProblemSection";
import EcosystemSection from "./components/EcosystemSection";
import TrustSection from "./components/TrustSection";
import LandingReviewsSection from "./components/LandingReviewsSection";
import CheckoutSection from "./components/CheckoutSection";
import RetentionSection from "./components/RetentionSection";
import NosotrosSection from "./components/NosotrosSection";
import DoubleCTASection from "./components/DoubleCTASection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <ProblemSection />
      <EcosystemSection />
      <TrustSection />
      <LandingReviewsSection />
      <CheckoutSection />
      <RetentionSection />
      <NosotrosSection />
      <DoubleCTASection />
      <Footer />
    </main>
  );
}
