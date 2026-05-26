import { Button } from "@/components/elements/Button";

export const metadata = { title: "Style preview — Tends" };

/** Throwaway page to preview the light-first / landing-flavored direction. */
export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0C1A2B]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        {/* Header — editorial Aspekta, negative tracking */}
        <p className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490]">
          Direction preview
        </p>
        <h1 className="mt-3 font-sans text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
          Light-first, with a little landing-page swagger.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[#5B7490]">
          Hover the buttons to see the wipe. Numbers stay mono, labels go calm
          sans, blue shows up only as a small accent.
        </p>

        {/* Buttons */}
        <section className="mt-16">
          <h2 className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490]">
            Buttons
          </h2>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button icon>Deploy Vault</Button>
            <Button>Deposit</Button>
            <Button variant="secondary">Cancel</Button>
            <Button loading loadingLabel="Confirm in wallet...">
              Deposit
            </Button>
            <Button disabled>Disabled</Button>
          </div>
          <p className="mt-3 font-mono text-[0.7rem] text-[#5B7490]">
            Hero CTA (Deploy) gets the diagonal arrow · the rest wipe without an
            icon · secondary is a quiet outline.
          </p>
        </section>

        {/* Stat cards — balanced density */}
        <section className="mt-16">
          <h2 className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490]">
            Cards
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <article className="rounded-2xl border border-[#DDE8F2] bg-white p-7">
              <p className="text-sm font-medium text-[#5B7490]">Total portfolio</p>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                  $12,450.00
                </span>
                <span className="font-mono text-sm text-[#16A34A]">+2.4%</span>
              </div>
              <p className="mt-3 text-xs text-[#5B7490]">
                Last rebalance · 2h ago
              </p>
            </article>

            <article className="rounded-2xl border border-[#DDE8F2] bg-white p-7">
              <p className="text-sm font-medium text-[#5B7490]">Risk level</p>
              <div className="mt-3">
                <span className="inline-flex items-center rounded-full border border-[#2C5EAD]/20 bg-[#EAF4FC] px-3 py-1 font-sans text-xs font-medium text-[#2C5EAD]">
                  Low
                </span>
              </div>
              <p className="mt-3 text-xs text-[#5B7490]">
                Conservative · bonds & stablecoin yield
              </p>
            </article>
          </div>
        </section>

        {/* Badge comparison — mono vs Aspekta */}
        <section className="mt-16">
          <h2 className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490]">
            Badges — mono vs Aspekta
          </h2>
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-20 text-xs text-[#5B7490]">Mono (now)</span>
              <span className="inline-flex items-center rounded-full border border-[#2C5EAD]/20 bg-[#EAF4FC] px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#2C5EAD]">
                Low
              </span>
              <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-yellow-700">
                Medium
              </span>
              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-red-600">
                High
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-20 text-xs text-[#5B7490]">Aspekta</span>
              <span className="inline-flex items-center rounded-full border border-[#2C5EAD]/20 bg-[#EAF4FC] px-3 py-1 font-sans text-xs font-medium text-[#2C5EAD]">
                Low
              </span>
              <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 font-sans text-xs font-medium text-yellow-700">
                Medium
              </span>
              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 font-sans text-xs font-medium text-red-600">
                High
              </span>
            </div>
          </div>
          <p className="mt-3 font-mono text-[0.7rem] text-[#5B7490]">
            Mono = teknis/terminal · Aspekta = lebih kalem & menyatu dengan teks
          </p>
        </section>

        <p className="mt-16 border-t border-[#DDE8F2] pt-6 font-mono text-[0.7rem] uppercase tracking-[0.06em] text-[#5B7490]">
          Preview only · not wired into the app yet
        </p>
      </div>
    </div>
  );
}
