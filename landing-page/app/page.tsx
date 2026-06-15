import Navbar          from '@/components/Navbar';
import HeroSection     from '@/components/HeroSection';
import HorizontalWords from '@/components/HorizontalWords';
import Strategies      from '@/components/Strategies';
import Footer          from '@/components/Footer';
import SmoothScroll    from '@/components/SmoothScroll';

export default function Home() {
  return (
    <SmoothScroll>
      <Navbar />
      <main>
        <HeroSection />
        <div data-white-section style={{ position: "relative", zIndex: 2, background: "#ffffff" }}>
          <Strategies />
          <HorizontalWords />
        </div>
      </main>
      <Footer />
    </SmoothScroll>
  );
}
