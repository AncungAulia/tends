export function StepHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      {sub && <p className="mt-1.5 text-sm text-[#5B7490]">{sub}</p>}
    </div>
  );
}
