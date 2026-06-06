import ActivityBar from "./components/ActivityBar";
import Hero from "./components/Hero";
import ProblemSection from "./components/ProblemSection";
import EcosystemSection from "./components/EcosystemSection";
import ReviewsSection from "./components/ReviewsSection";
import CheckoutSection from "./components/CheckoutSection";
import RetentionSection from "./components/RetentionSection";
import NosotrosSection from "./components/NosotrosSection";
import DoubleCTASection from "./components/DoubleCTASection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main>
      <ActivityBar />
      <Hero />
      <ProblemSection />
      <EcosystemSection />
      <ReviewsSection />
      <CheckoutSection />
      <RetentionSection />
      <NosotrosSection />
      <DoubleCTASection />
      <Footer />
    </main>
  );
}
