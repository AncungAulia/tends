import { GlobalHeader } from "@/components/preview/GlobalHeader";
import { PreviewSidebar } from "@/components/preview/PreviewSidebar";

/* Shared shell for the /preview app pages (overview, agent, activity, plan,
   account). Sidebar + header live here so they PERSIST across navigation and
   never re-animate; only the page content (wrapped by template.tsx) fades in. */

export default function PreviewAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F9FBFC] text-[#0C1A2B]">
      <PreviewSidebar />
      <main className="flex-1">
        <GlobalHeader bgClass="bg-[#F9FBFC]" borderClass="border-b-[1.5px] border-[#E8EAEC]" />
        {children}
      </main>
    </div>
  );
}
