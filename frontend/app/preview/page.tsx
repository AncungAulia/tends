import { LiveRunCard } from "@/components/preview/LiveRunCard";

export const metadata = { title: "Component Preview — Tends" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <p className="mb-5 font-sans text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-dim">
        {title}
      </p>
      {children}
    </section>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <p className="mb-3 mt-6 text-[0.625rem] uppercase tracking-[0.1em] text-faint">{label}</p>
  );
}

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-card text-ink">
      <div className="mx-auto max-w-2xl px-8 py-16">

        {/* Header */}
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-dim">
          Tends · Component System
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">
          Design Preview
        </h1>
        <p className="mt-2 text-sm text-dim">
          Semua komponen yang dipakai di app. Aspekta font, light theme, Mercury-inspired.
        </p>

        {/* ── BUTTONS ─────────────────────────────────────────── */}
        <Section title="Buttons">

          <Divider label="Primary" />
          <div className="flex flex-wrap items-center gap-3">
            {/* PRIMARY — blue solid */}
            <button className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]">
              Deposit
            </button>
            {/* PRIMARY loading */}
            <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white opacity-70">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Confirm in wallet...
            </button>
            {/* PRIMARY disabled */}
            <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white opacity-30">
              Deposit
            </button>
          </div>

          <Divider label="Secondary" />
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-[#d6ecf8] active:scale-[0.98]">
              Withdraw
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-[#e4e4e4] bg-card px-4 py-2 text-sm font-medium text-dim transition-colors hover:border-dim hover:text-ink active:scale-[0.98]">
              Go Back
            </button>
            <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-edge bg-card px-4 py-2 text-sm font-medium text-dim opacity-40">
              Cancel
            </button>
          </div>

          <Divider label="Side by side — Deposit / Withdraw" />
          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-5 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-[#d6ecf8] active:scale-[0.98]">
              Withdraw
            </button>
            <button className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]">
              Deposit
            </button>
          </div>

          <Divider label="Ghost / Text" />
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-opacity hover:opacity-70">
              View all →
            </button>
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-dim transition-colors hover:text-ink">
              Skip for now
            </button>
          </div>

          <Divider label="Destructive" />
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-neg transition-colors hover:bg-neg-soft active:scale-[0.98]">
              Disconnect
            </button>
          </div>

          <Divider label="Icon buttons" />
          <div className="flex flex-wrap items-center gap-3">
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-dim transition-colors hover:bg-slate-200 hover:text-ink">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2v12M2 8h12" />
              </svg>
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-dim transition-colors hover:bg-neg-soft hover:text-neg">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" />
              </svg>
            </button>
          </div>

        </Section>

        {/* ── BADGES ──────────────────────────────────────────── */}
        <Section title="Badges & Pills">

          <Divider label="Risk level" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-[#2C5EAD]/20 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              Low
            </span>
            <span className="inline-flex items-center rounded-full border border-yellow-200 bg-warn-soft px-3 py-1 text-xs font-medium text-warn">
              Medium
            </span>
            <span className="inline-flex items-center rounded-full border border-red-200 bg-neg-soft px-3 py-1 text-xs font-medium text-neg">
              High
            </span>
          </div>

          <Divider label="Agent status" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-pos-soft px-3 py-1 text-xs font-medium text-pos">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pos-soft0" />
              Active
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              Analyzing
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
              Rebalancing
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-panel px-3 py-1 text-xs font-medium text-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-edge" />
              Paused
            </span>
          </div>

          <Divider label="Activity type" />
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Rebalance", color: "bg-brand-soft text-brand border-brand/20" },
              { label: "Deposit", color: "bg-pos-soft text-pos border-green-200" },
              { label: "Withdraw", color: "bg-neg-soft text-neg border-red-200" },
              { label: "Scan", color: "bg-panel text-dim border-edge" },
            ].map(({ label, color }) => (
              <span key={label} className={`inline-flex rounded-md border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em] ${color}`}>
                {label}
              </span>
            ))}
          </div>

        </Section>

        {/* ── CARDS ───────────────────────────────────────────── */}
        <Section title="Cards">

          <Divider label="Stat — raw, no card (Mercury-style)" />
          <div className="grid grid-cols-2 gap-8 py-2">
            <div>
              <p className="text-xs text-dim">Total Portfolio</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-ink">
                $12,430.50
              </p>
              <p className="mt-1 text-xs font-medium text-pos">↑ +2.31% all time</p>
            </div>
            <div>
              <p className="text-xs text-dim">Agent Status</p>
              <div className="mt-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-pos-soft px-3 py-1 text-xs font-medium text-pos">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pos-soft0" />
                  Active
                </span>
              </div>
              <p className="mt-1 text-xs text-dim">Withdrawals always open</p>
            </div>
          </div>

          <Divider label="Content card — bg fill, no border" />
          <div className="overflow-hidden rounded-xl bg-panel">
            {[
              { sym: "cmETH", name: "Mantle LST", pct: 40, val: "$4,972", delta: "+0.8%", bar: "bg-[#2C5EAD]", w: "w-4/5", icon: "bg-brand-soft text-brand" },
              { sym: "sUSDe", name: "Ethena", pct: 35, val: "$4,351", delta: "+0.1%", bar: "bg-brand", w: "w-[70%]", icon: "bg-brand-soft text-brand" },
              { sym: "USDC",  name: "Stablecoin", pct: 25, val: "$3,107", delta: "—", bar: "bg-[#4BB8FA]", w: "w-1/2", icon: "bg-brand-soft text-[#4BB8FA]" },
            ].map((h, i, arr) => (
              <div key={h.sym} className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#edf2f7] ${i < arr.length - 1 ? "border-b border-white/60" : ""}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.5625rem] font-bold ${h.icon}`}>{h.sym.slice(0,2)}</div>
                <div className="w-20 shrink-0">
                  <p className="text-sm font-semibold text-ink">{h.sym}</p>
                  <p className="text-[0.625rem] text-dim">{h.name}</p>
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-[2px] bg-[#e8eef4]">
                    <div className={`h-1.5 rounded-[2px] ${h.bar} ${h.w}`} />
                  </div>
                  <span className="w-8 text-right text-[0.625rem] text-dim">{h.pct}%</span>
                </div>
                <div className="w-16 text-right">
                  <p className="text-sm font-semibold text-ink">{h.val}</p>
                  <p className={`text-[0.625rem] ${h.delta === "—" ? "text-faint" : "text-pos"}`}>{h.delta}</p>
                </div>
              </div>
            ))}
          </div>

        </Section>

        {/* ── INPUTS ──────────────────────────────────────────── */}
        <Section title="Inputs">

          <Divider label="Amount field" />
          <div className="rounded-xl border border-edge bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-dim">Amount</label>
              <span className="text-xs text-dim">Balance: <span className="font-medium text-ink">1,000.00 USDC</span></span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-edge px-4 py-3 focus-within:border-brand focus-within:ring-1 focus-within:ring-[#1591DC]/20 transition-all">
              <input
                type="text"
                defaultValue="500"
                className="flex-1 bg-transparent text-lg font-semibold tracking-[-0.02em] text-ink outline-none placeholder:text-faint"
              />
              <span className="text-sm font-medium text-dim">USDC</span>
              <button className="rounded-md bg-brand-soft px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-brand hover:bg-brand hover:text-white transition-colors">
                Max
              </button>
            </div>
            <p className="mt-2 text-xs text-dim">≈ $500.00 USD</p>
          </div>

          <Divider label="Focus state" />
          <div className="rounded-xl border border-brand bg-card p-5 ring-1 ring-[#1591DC]/20">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-brand">Amount</label>
              <span className="text-xs text-dim">Balance: <span className="font-medium text-ink">1,000.00 USDC</span></span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-brand px-4 py-3">
              <input defaultValue="500" className="flex-1 bg-transparent text-lg font-semibold tracking-[-0.02em] text-ink outline-none" />
              <span className="text-sm font-medium text-dim">USDC</span>
              <button className="rounded-md bg-brand px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-white">Max</button>
            </div>
          </div>

          <Divider label="Error state" />
          <div className="rounded-xl border border-red-200 bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-neg">Amount</label>
              <span className="text-xs text-dim">Balance: <span className="font-medium text-ink">1,000.00 USDC</span></span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-red-300 px-4 py-3">
              <input defaultValue="2000" className="flex-1 bg-transparent text-lg font-semibold tracking-[-0.02em] text-ink outline-none" />
              <span className="text-sm font-medium text-dim">USDC</span>
              <button className="rounded-md bg-brand-soft px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-brand">Max</button>
            </div>
            <p className="mt-2 text-xs text-neg">Amount exceeds your balance</p>
          </div>

        </Section>

        {/* ── LIVE RUN CARD ───────────────────────────────────── */}
        <Section title="Live Run Card — agent execution, real-time">
          <LiveRunCard />
          <p className="mt-3 text-[0.6875rem] text-dim">
            Klik &ldquo;Run agent&rdquo; untuk lihat agent jalan step-by-step. Tiap step punya data visualnya sendiri (harga, sinyal, guardrail, keputusan, swap, ringkasan).
          </p>
        </Section>

        {/* ── TERMINAL ────────────────────────────────────────── */}
        <Section title="Agent Terminal">
          <div className="overflow-hidden rounded-xl border border-ink/10 bg-tip">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
                </div>
                <span className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-white/25">Tends Agent · log</span>
              </div>
              <button className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[0.625rem] text-white/40 hover:text-white/70 transition-colors">
                See full log ↑
              </button>
            </div>
            <div className="space-y-0.5 px-5 py-4 font-mono text-[0.6875rem]">
              {[
                { ts: "14:32:09", tag: "DONE",    tagCls: "bg-green-950 text-green-400",   msg: "Portfolio rebalanced · +0.3% APY · view reasoning" },
                { ts: "14:32:07", tag: "EXEC",    tagCls: "bg-purple-950 text-purple-300", msg: "Confirmed · tx 0x8c1b...3f9e" },
                { ts: "14:32:05", tag: "DECIDE",  tagCls: "bg-indigo-950 text-indigo-300", msg: "Shift 15% cmETH → sUSDe · confidence 87%" },
                { ts: "14:32:03", tag: "SIGNAL",  tagCls: "bg-yellow-950 text-yellow-400", msg: "cmETH vol +12.4% · sUSDe yield 4.2%" },
                { ts: "14:32:01", tag: "SCAN",    tagCls: "bg-white/5 text-white/30",      msg: "Scheduled check · 3 assets analyzed" },
              ].map(({ ts, tag, tagCls, msg }) => (
                <div key={ts} className="flex items-baseline gap-3 py-1">
                  <span className="w-14 shrink-0 text-white/20">{ts}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.05em] ${tagCls}`}>{tag}</span>
                  <span className="text-white/45">{msg}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── TYPOGRAPHY ──────────────────────────────────────── */}
        <Section title="Typography">
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[0.625rem] uppercase tracking-[0.1em] text-faint">Page title</p>
              <p className="text-4xl font-semibold tracking-[-0.04em] text-ink">Portfolio</p>
            </div>
            <div>
              <p className="mb-1 text-[0.625rem] uppercase tracking-[0.1em] text-faint">Section title</p>
              <p className="text-base font-semibold text-ink">Holdings</p>
            </div>
            <div>
              <p className="mb-1 text-[0.625rem] uppercase tracking-[0.1em] text-faint">Body</p>
              <p className="text-sm text-dim">Tends Agent manages your portfolio automatically based on your risk preference. You can withdraw at any time.</p>
            </div>
            <div>
              <p className="mb-1 text-[0.625rem] uppercase tracking-[0.1em] text-faint">Label / caption</p>
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-dim">Total Portfolio Value</p>
            </div>
            <div>
              <p className="mb-1 text-[0.625rem] uppercase tracking-[0.1em] text-faint">Big number</p>
              <p className="text-3xl font-semibold tracking-[-0.04em] text-ink">$12,430.50</p>
            </div>
          </div>
        </Section>

        <p className="mt-16 border-t border-edge pt-6 text-[0.625rem] uppercase tracking-[0.1em] text-faint">
          Preview only — Tends component system
        </p>
      </div>
    </div>
  );
}
