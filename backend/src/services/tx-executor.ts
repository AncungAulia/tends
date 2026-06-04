import { encodeFunctionData, parseUnits } from "viem";
import {
  ERC20_ABI,
  USER_VAULT_TX_ABI,
  VAULT_FACTORY_TX_ABI,
} from "../chain/abis.js";
import { TOKENS } from "../chain/tokens.js";
import { addresses, as0x } from "../chain/addresses.js";

/** Unsigned tx returned to the frontend for the user to sign via Privy. */
export interface PreparedTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
}

// toFixed(decimals) — never exponential for sane amounts (unlike Number.toString(),
// which goes "1e-7"/"1e+21" and makes parseUnits throw), and truncates to 6 dp.
const usdc = (amount: number) =>
  parseUnits(amount.toFixed(TOKENS.USDC.decimals), TOKENS.USDC.decimals);

/**
 * Pure calldata encoders for user-initiated actions on their own vault. The
 * backend never holds user keys — the frontend signs these via Privy (docs §3).
 * Agent-signed txs (rebalance, relayer) live elsewhere.
 *
 * Exact signatures from smart-contract/src/{UserVault,VaultFactory}.sol.
 */
export class TxExecutorService {
  /** USDC.approve(vault, amount) — step 1 of a deposit (unless using permit). */
  prepareApproveUsdc(vault: `0x${string}`, amount: number): PreparedTx {
    return {
      to: as0x(TOKENS.USDC.address),
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vault, usdc(amount)],
      }),
      value: "0",
    };
  }

  /** UserVault.deposit(assets, receiver) — ERC-4626 deposit. */
  prepareDeposit(vault: `0x${string}`, receiver: `0x${string}`, amount: number): PreparedTx {
    return {
      to: vault,
      data: encodeFunctionData({
        abi: USER_VAULT_TX_ABI,
        functionName: "deposit",
        args: [usdc(amount), receiver],
      }),
      value: "0",
    };
  }

  /** UserVault.depositWithPermit(...) — ERC-2612 permit + deposit in one tx. */
  prepareDepositWithPermit(
    vault: `0x${string}`,
    receiver: `0x${string}`,
    amount: number,
    deadline: bigint,
    v: number,
    r: `0x${string}`,
    s: `0x${string}`,
  ): PreparedTx {
    return {
      to: vault,
      data: encodeFunctionData({
        abi: USER_VAULT_TX_ABI,
        functionName: "depositWithPermit",
        args: [usdc(amount), receiver, deadline, v, r, s],
      }),
      value: "0",
    };
  }

  /** UserVault.withdraw(assets, receiver, owner). */
  prepareWithdraw(vault: `0x${string}`, owner: `0x${string}`, amount: number): PreparedTx {
    return {
      to: vault,
      data: encodeFunctionData({
        abi: USER_VAULT_TX_ABI,
        functionName: "withdraw",
        args: [usdc(amount), owner, owner],
      }),
      value: "0",
    };
  }

  /** VaultFactory.deployVault() — first-time users create their vault. */
  prepareDeployVault(): PreparedTx {
    return {
      to: as0x(addresses.vaultFactory),
      data: encodeFunctionData({
        abi: VAULT_FACTORY_TX_ABI,
        functionName: "deployVault",
        args: [],
      }),
      value: "0",
    };
  }

  /** UserVault.setRiskLevel(level) — switch strategy (0=LOW 1=MED 2=HIGH 3=CUSTOM). */
  prepareSetRisk(vault: `0x${string}`, riskLevel: number): PreparedTx {
    return {
      to: vault,
      data: encodeFunctionData({
        abi: USER_VAULT_TX_ABI,
        functionName: "setRiskLevel",
        args: [riskLevel],
      }),
      value: "0",
    };
  }

  /** UserVault.setCustomAllocation(lowBps, medBps, highBps) — for CUSTOM risk. */
  prepareSetCustomAllocation(
    vault: `0x${string}`,
    lowBps: number,
    medBps: number,
    highBps: number,
  ): PreparedTx {
    return {
      to: vault,
      data: encodeFunctionData({
        abi: USER_VAULT_TX_ABI,
        functionName: "setCustomAllocation",
        args: [lowBps, medBps, highBps],
      }),
      value: "0",
    };
  }
}

export interface PermitTypedData {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
  types: { Permit: { name: string; type: string }[] };
  primaryType: "Permit";
  message: {
    owner: `0x${string}`;
    spender: `0x${string}`;
    value: bigint;
    nonce: bigint;
    deadline: bigint;
  };
}

/**
 * EIP-2612 permit typed data for USDC (MockUSDC = OZ ERC20Permit, name "USD Coin",
 * version "1"). The frontend signs this (Privy signTypedData), splits the signature,
 * and posts it to /prepare-deposit-permit. `nonce` comes from USDC.nonces(owner).
 */
export function permitTypedData(p: {
  chainId: number;
  owner: `0x${string}`;
  spender: `0x${string}`;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}): PermitTypedData {
  return {
    domain: {
      name: "USD Coin",
      version: "1",
      chainId: p.chainId,
      verifyingContract: as0x(TOKENS.USDC.address),
    },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner: p.owner, spender: p.spender, value: p.value, nonce: p.nonce, deadline: p.deadline },
  };
}

export const txExecutorService = new TxExecutorService();
