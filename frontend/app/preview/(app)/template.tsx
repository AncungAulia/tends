/* template.tsx re-mounts on every navigation (App Router contract), so the
   .page-enter CSS animation re-fires each time you switch pages. The sidebar +
   header are in layout.tsx (which does NOT re-mount), so they stay put. */

export default function PreviewAppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
