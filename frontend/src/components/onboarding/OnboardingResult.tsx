import Link from "next/link";
import VaultCard from "@/components/elements/VaultCard";
import { TokenIcon, tokenColor } from "@/components/elements/TokenIcon";
import { RISK_MIX, RISK_DESC, RISK_BADGE } from "./constants";
import type { Risk } from "./types";

interface Props {
  name: string;
  risk: Risk;
  stopLoss: number;
  ctaHref: string;
}

export function OnboardingResult({ name, risk, stopLoss, ctaHref }: Props) {
  const mix = RISK_MIX[risk];
  return (
    <div>
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          {name ? `You're all set, ${name}!` : "You're all set!"}
        </h2>
        <p className="mt-1.5 text-sm text-[#5B7490]">
          Your vault is ready. Your agent takes it from here.
        </p>
      </div>

      <div className="mb-5">
        <VaultCard name={name} risk={risk} balance={0} />
      </div>

      <div className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">
            Starting plan
          </p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${RISK_BADGE[risk]}`}>
            {risk} risk
          </span>
        </div>
        <p className="mt-2 text-sm text-[#0C1A2B]">{RISK_DESC[risk]}</p>

        <div className="mt-4 flex h-3.5">
          {mix.map((m, i) => (
            <div
              key={m.sym}
              style={{
                flexGrow: m.pct,
                background: tokenColor(m.sym),
                marginLeft: i === 0 ? 0 : -5,
                zIndex: mix.length - i,
              }}
              className="relative basis-0 rounded-[3px]"
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {mix.map((m) => (
            <span key={m.sym} className="flex items-center gap-1.5 text-xs text-[#5B7490]">
              <TokenIcon sym={m.sym} color={tokenColor(m.sym)} size={16} />
              {m.sym} {m.pct}%
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[#E8EAEC] pt-4">
          <div>
            <p className="text-sm font-medium text-[#0C1A2B]">Downside protection</p>
            <p className="text-xs text-[#5B7490]">Agent pauses if you drop past this</p>
          </div>
          <span className="text-sm font-semibold text-[#0C1A2B]">-{stopLoss}%</span>
        </div>
      </div>

      <p className="mt-3 px-1 text-xs text-[#94A3B8]">You can change your plan anytime.</p>

      <Link
        href={ctaHref}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1591DC] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Enter Tends
      </Link>
    </div>
  );
}
