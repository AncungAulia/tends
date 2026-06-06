import { GlobalHeader } from "@/components/preview/GlobalHeader";
import { PreviewSidebar } from "@/components/preview/PreviewSidebar";
import { MobileTopBar } from "@/components/preview/MobileTopBar";
import { BottomNav } from "@/components/preview/BottomNav";

/* Shared shell for the /preview app pages (overview, agent, activity, plan,
   account). Desktop: collapsible sidebar (hidden md:flex). Mobile: a top bar +
   floating bottom nav (both md:hidden). All live here so they PERSIST across
   navigation; only the page content (wrapped by template.tsx) fades in. */

export default function PreviewAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-app text-ink">
      <PreviewSidebar />
      <main className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <MobileTopBar />
        {/* <GlobalHeader bgClass="bg-app" borderClass="border-b-[1.5px] border-edge" /> */}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
