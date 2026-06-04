"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, custom, http } from "viem";
import { mantleSepolia, RPC_URL } from "@/lib/chains";
import { apiFetch } from "@/lib/api";
import { ADDRESSES, USDC_ADDRESS } from "@/lib/addresses";

// Shared read client for gas estimation (wallet estimates run tight on Mantle).
const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(RPC_URL),
});

export type Tx = { to: `0x${string}`; data: `0x${string}`; value: string };

export type BackendTxState =
  | "idle"
  | "pending"
  | "confirming"
  | "success"
  | "error";

// Contracts the backend is allowed to target. The user's vault address is added
// per-call. Anything else → refuse to sign.
const BASE_ALLOWED_TARGETS = new Set<string>([
  ADDRESSES.VAULT_FACTORY.toLowerCase(),
  USDC_ADDRESS.toLowerCase(),
]);

function verifyTx(tx: Tx, vaultAddress?: string): void {
  const allowed = new Set(BASE_ALLOWED_TARGETS);
  if (vaultAddress) allowed.add(vaultAddress.toLowerCase());
  if (!allowed.has(tx.to.toLowerCase())) {
    throw new Error(`Unexpected tx target: ${tx.to} — refusing to sign`);
  }
}

/**
 * Core signing engine for all backend-prepared transactions.
 * 1. POST to a backend endpoint → receive unsigned `tx` or `steps: Tx[]`
 * 2. Verify every `tx.to` against the known-contract whitelist
 * 3. Sign each tx sequentially with the Privy embedded wallet
 */
export function useBackendTx() {
  const { wallets } = useWallets();
  const { getAccessToken } = usePrivy();
  const [state, setState] = useState<BackendTxState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hashes, setHashes] = useState<`0x${string}`[]>([]);

  const signTx = async (tx: Tx): Promise<`0x${string}`> => {
    const wallet = wallets[0];
    if (!wallet) throw new Error("No wallet connected");

    // Ensure the wallet is on Mantle Sepolia before signing (it may default to
    // mainnet or another chain). Switches/adds the chain in the wallet.
    try {
      await wallet.switchChain(mantleSepolia.id);
    } catch {
      throw new Error(
        "Please switch your wallet to Mantle Sepolia and try again.",
      );
    }

    const provider = await wallet.getEthereumProvider();
    const client = createWalletClient({
      account: wallet.address as `0x${string}`,
      chain: mantleSepolia,
      transport: custom(provider),
    });

    const value = BigInt(tx.value ?? "0");

    // Estimate gas ourselves + add a 50% buffer. Wallet estimation on Mantle
    // sometimes runs too low and the tx reverts "out of gas". Fall back to
    // wallet estimation if our estimate fails.
    let gas: bigint | undefined;
    try {
      const estimated = await publicClient.estimateGas({
        account: wallet.address as `0x${string}`,
        to: tx.to,
        data: tx.data,
        value,
      });
      gas = (estimated * 3n) / 2n;
    } catch {
      gas = undefined;
    }

    return client.sendTransaction({ to: tx.to, data: tx.data, value, gas });
  };

  const execute = async <TResp extends { tx?: Tx; steps?: Tx[] }>(
    path: string,
    body: object,
    vaultAddress?: string,
  ): Promise<`0x${string}`[]> => {
    setState("pending");
    setError(null);
    setHashes([]);

    try {
      const token = await getAccessToken();
      const data = await apiFetch<TResp>(path, token, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const txs: Tx[] = data.steps ?? (data.tx ? [data.tx] : []);
      if (txs.length === 0) throw new Error("Backend returned no transaction");

      // Verify ALL targets before signing anything
      for (const tx of txs) verifyTx(tx, vaultAddress);

      setState("confirming");

      const results: `0x${string}`[] = [];
      for (const tx of txs) {
        results.push(await signTx(tx));
      }

      setHashes(results);
      setState("success");
      return results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setError(msg);
      setState("error");
      throw err;
    }
  };

  const reset = () => {
    setState("idle");
    setError(null);
    setHashes([]);
  };

  return {
    execute,
    reset,
    state,
    error,
    hashes,
    isPending: state === "pending",
    isConfirming: state === "confirming",
    isSuccess: state === "success",
  };
}
