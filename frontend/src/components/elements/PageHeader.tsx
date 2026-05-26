export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-4">
      <div className="overflow-hidden pb-1">
        <h1 className="animate-[tends-rise_0.5s_cubic-bezier(0.22,1,0.36,1)] font-sans text-3xl font-bold tracking-[-0.03em] text-[#0C1A2B] motion-reduce:animate-none dark:text-white sm:text-4xl">
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}
