import { encodeFunctionData, parseUnits } from "viem";
import { childLogger } from "../lib/logger.js";
import { USER_VAULT_ABI } from "../chain/abis.js";
import { TOKENS } from "../chain/tokens.js";

const log = childLogger("tx-executor");

/** Unsigned tx returned to the frontend for the user to sign via Privy. */
export interface PreparedTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
}

// ERC-4626 withdraw isn't in our trimmed USER_VAULT_ABI; declare just what we encode.
const WITHDRAW_ABI = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

/**
 * Prepares UNSIGNED calldata for user-initiated actions on their own UserVault
 * (deposit/withdraw). The backend never holds user keys — the frontend signs via
 * Privy (docs §3 signature flow). Agent-signed txs (rebalance, pushPrices) live in
 * rebalancer.ts / price-pusher.ts and use the AGENT_EXECUTOR wallet instead.
 *
 * Blocked on deployed vault addresses (USE_MOCK_CONTRACTS=true until deploy).
 */
export class TxExecutorService {
  /** Withdraw `amount` USDC from the user's vault back to their wallet. */
  prepareWithdrawTx(
    vault: `0x${string}`,
    walletAddress: `0x${string}`,
    amount: number,
  ): PreparedTx {
    const assets = parseUnits(amount.toString(), TOKENS.USDC.decimals);
    const data = encodeFunctionData({
      abi: WITHDRAW_ABI,
      functionName: "withdraw",
      args: [assets, walletAddress, walletAddress],
    });
    log.info({ vault, walletAddress, amount }, "prepared withdraw tx");
    return { to: vault, data, value: "0" };
  }

  // TODO: prepareDepositTx (ERC-2612 permit + deposit), prepareDeployVaultTx
  // (VaultFactory.deployVault for first-time users). Need final ABIs + decimals.
}

void USER_VAULT_ABI; // referenced by future deposit encoding
export const txExecutorService = new TxExecutorService();
