import Navbar          from '@/components/Navbar';
import HeroSection     from '@/components/HeroSection';
import WhyTends        from '@/components/WhyTends';
import StatsBand       from '@/components/StatsBand';
import ChatShowcase    from '@/components/ChatShowcase';
import HorizontalWords from '@/components/HorizontalWords';
import Footer          from '@/components/Footer';
import SmoothScroll    from '@/components/SmoothScroll';

export default function Home() {
  return (
    <SmoothScroll>
      <Navbar />
      <main>
        <HeroSection />
        {/* Light run: the three pitch sections then HorizontalWords, all under
            one [data-white-section] so the Navbar stays in its light scheme. */}
        <div data-white-section style={{ position: "relative", zIndex: 2, background: "#F7F9FC" }}>
          <WhyTends />
          <StatsBand />
          <ChatShowcase />
          <HorizontalWords />
          {/* HorizontalWords carries its own bg-bg (#F7F9FC), matching the run. */}
        </div>
      </main>
      <Footer />
    </SmoothScroll>
  );
}
