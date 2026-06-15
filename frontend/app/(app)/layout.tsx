import { DefaultLayout } from "@/components/layouts/DefaultLayout";
import { RequireOnboarded } from "@/components/auth/RequireOnboarded";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireOnboarded>
      <DefaultLayout>{children}</DefaultLayout>
    </RequireOnboarded>
  );
}
