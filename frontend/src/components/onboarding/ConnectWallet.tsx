import { Wallet } from "lucide-react";

export function ConnectWallet({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">
        Let&apos;s set up your money
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#5B7490]">
        Connect your wallet to begin. It stays yours. Your agent can manage it,
        but can never move it out to itself.
      </p>
      <button
        onClick={onConnect}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1591DC] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Wallet className="h-4 w-4" /> Connect wallet
      </button>
      <p className="mt-4 text-xs text-[#94A3B8]">
        A minute of quick questions after this, then you&apos;re set.
      </p>
    </div>
  );
}
