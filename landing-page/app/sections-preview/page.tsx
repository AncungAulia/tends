import WhyTends from "@/components/WhyTends";
import StatsBand from "@/components/StatsBand";
import ChatShowcase from "@/components/ChatShowcase";

/* Throwaway preview for the 3 proposed landing sections. Review here, tweak,
   then drop into app/page.tsx. Delete this route before ship. */
export default function SectionsPreview() {
  return (
    <main style={{ background: "#F7F9FC" }}>
      <WhyTends />
      <StatsBand />
      <ChatShowcase />
    </main>
  );
}
