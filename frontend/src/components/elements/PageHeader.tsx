export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <h1 className="font-sans text-4xl font-semibold tracking-[-0.04em] text-[#0C1A2B] dark:text-white">
        {title}
      </h1>
      {action}
    </header>
  );
}
