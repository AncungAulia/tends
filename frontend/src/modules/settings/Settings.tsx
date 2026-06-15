"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { PageHeader } from "@/components/elements/PageHeader";
import { Card } from "@/components/elements/Card";
import { Button } from "@/components/elements/Button";
import { AddressDisplay } from "@/components/elements/AddressDisplay";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useMintTestUsdc } from "@/hooks/useMintTestUsdc";
import { cn } from "@/utils/cn";

const IS_TESTNET = process.env.NEXT_PUBLIC_CHAIN_ID === "5003";

const ACTIVITY_VIEW_KEY = "tends_activity_view";

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-edge p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.04em] transition-colors",
            value === o.value
              ? "bg-brand-soft text-brand"
              : "text-dim",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink">{label}</span>
      {children}
    </div>
  );
}

export function Settings() {
  const { user, logout } = usePrivy();
  const { address } = useAccount();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activityView, setActivityView] = useState<"table" | "timeline">("table");

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(ACTIVITY_VIEW_KEY) as "table" | "timeline" | null;
    if (saved) setActivityView(saved);
  }, []);

  const setView = (v: "table" | "timeline") => {
    setActivityView(v);
    localStorage.setItem(ACTIVITY_VIEW_KEY, v);
  };

  // Testnet faucet
  const { balance, refetch: refetchBalance } = useUSDCBalance(address);
  const { mint, isPending, isConfirming, isSuccess, reset } = useMintTestUsdc();
  const minting = isPending || isConfirming;

  useEffect(() => {
    if (isSuccess) {
      toast.success("Minted 1,000 test USDC.");
      refetchBalance();
      reset();
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectedVia =
    user?.google?.email
      ? "via Google"
      : user?.email?.address
        ? "via Email"
        : "via Wallet";

  return (
    <>
      <PageHeader title="Settings" />

      <div className="max-w-xl space-y-6">
        <Card className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <AddressDisplay address={address} />
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-dim">
              {connectedVia}
            </span>
          </div>
        </Card>

        <div>
          <h3 className="mb-2 font-sans text-sm font-semibold text-ink">
            Appearance
          </h3>
          <Card>
            <Row label="Theme">
              {mounted && (
                <Segmented
                  value={(theme as string) ?? "system"}
                  onChange={setTheme}
                  options={[
                    { label: "System", value: "system" },
                    { label: "Light", value: "light" },
                    { label: "Dark", value: "dark" },
                  ]}
                />
              )}
            </Row>
          </Card>
        </div>

        <div>
          <h3 className="mb-2 font-sans text-sm font-semibold text-ink">
            Preferences
          </h3>
          <Card>
            <Row label="Activity view">
              <Segmented
                value={activityView}
                onChange={setView}
                options={[
                  { label: "Table", value: "table" },
                  { label: "Timeline", value: "timeline" },
                ]}
              />
            </Row>
          </Card>
        </div>

        {IS_TESTNET && (
          <div>
            <h3 className="mb-2 font-sans text-sm font-semibold text-ink">
              Testnet
            </h3>
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">
                  Test USDC balance
                </span>
                <span className="font-mono text-sm text-ink">
                  {balance} USDC
                </span>
              </div>
              <Button
                variant="secondary"
                onClick={() => mint(1000)}
                loading={minting}
                loadingLabel={isPending ? "Confirm in wallet..." : "Minting..."}
                disabled={!address}
              >
                Mint 1,000 test USDC
              </Button>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-dim">
                Dev faucet · needs a little MNT for gas
              </p>
            </Card>
          </div>
        )}

        <Button variant="destructive" onClick={logout}>
          Disconnect Wallet
        </Button>
      </div>
    </>
  );
}
