import StrategyAccordion from "@/components/StrategyAccordion";

// Standalone preview for the strategy accordion (built here first so it can't
// break the live Strategies section). Later this can be merged with the 3D bot.
export default function CardsPreviewPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F0F4F8 0%, #F7F9FC 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Anchor to the top (NOT center): centering re-positions the whole
        // stack every frame as a card's height animates, which reads as jitter.
        justifyContent: "flex-start",
        padding: "120px 24px 80px",
        gap: 40,
        overflowX: "hidden", // cards slide in from off the right edge
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-sans, sans-serif)",
          fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#0C1A2B",
          textAlign: "center",
        }}
      >
        Choose your strategy
      </h2>

      <StrategyAccordion />

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-sans, sans-serif)",
          fontSize: 12,
          color: "#5b7490",
        }}
      >
        Arahkan kursor ke sebuah baris — ia mengembang menampilkan subteks +
        placeholder gambar.
      </p>
    </main>
  );
}
