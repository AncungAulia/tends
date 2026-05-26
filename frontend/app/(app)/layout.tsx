import { DefaultLayout } from "@/components/layouts/DefaultLayout";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
