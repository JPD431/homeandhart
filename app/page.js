import ActivityBar from "./components/ActivityBar";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import MetricsBar from "./components/MetricsBar";
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
      <Navbar />
      <Hero />
      <MetricsBar />
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
