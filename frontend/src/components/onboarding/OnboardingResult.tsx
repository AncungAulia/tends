import Link from "next/link";
import VaultCard from "@/components/elements/VaultCard";
import type { Risk } from "./types";

interface Props {
  name: string;
  risk: Risk;
  stopLoss: number;
  ctaHref: string;
}

export function OnboardingResult({ name, risk, ctaHref }: Props) {
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

      <VaultCard name={name} risk={risk} />

      <Link
        href={ctaHref}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1591DC] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Enter Tends
      </Link>
    </div>
  );
}
