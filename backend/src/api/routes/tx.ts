import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { parseSignature } from "viem";
import { z } from "zod";
import { txExecutorService as tx } from "../../services/tx-executor.js";
import { gasFunderService } from "../../services/gas-funder.js";
import { riskLevelFromId } from "../../strategies.js";
import { RISK_LEVEL, TOKENS } from "../../chain/tokens.js";
import { env } from "../../config/env.js";
import { childLogger } from "../../lib/logger.js";
import { getAgentWallet, publicClient, activeChain } from "../../chain/index.js";
import { USER_VAULT_TX_ABI, ERC20_ABI } from "../../chain/abis.js";
import { as0x } from "../../chain/addresses.js";
import { requireAuth, type AuthVars } from "../auth.js";
import { prisma } from "../../db/client.js";

const log = childLogger("tx");

/** Best-effort gas top-up before a user-signed tx (docs §A.5). Never blocks. */
async function tryEnsureGas(account: `0x${string}`): Promise<void> {
  if (!env.PRIVATE_KEY_GAS_FUNDER) return;
  try {
    await gasFunderService.ensureGasFunded(account);
  } catch (err) {
    log.warn({ account, err }, "gas top-up failed (non-blocking)");
  }
}

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid address");
// bounded so amount.toFixed(6) never goes exponential (≥1e21) and rejects dust (<1 unit)
const amount = z.number().min(0.000001).max(1_000_000_000_000);
const bps = z.number().int().min(0).max(10_000);

const depositBody = z.object({ vault: address, account: address, amount });
const withdrawBody = depositBody;
const permitBody = z.object({
  vault: address,
  account: address,
  amount,
  deadline: z.number().int().positive(), // unix seconds
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "expected a 65-byte signature"),
});
const switchBody = z.object({
  vault: address,
  strategyId: z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]),
  customAllocation: z
    .object({ lowBps: bps, medBps: bps, highBps: bps })
    .optional(),
});

// ── Agent control (BE-A) — owner-signed on-chain controls ──────────────────────
const pauseBody = z.object({ vault: address, reason: z.string().max(200).optional() });
const unpauseBody = z.object({ vault: address });
// intervalSec bound mirrors the cadenceSec convention (0 = no on-chain cooldown, ≤ 1 year).
const frequencyBody = z.object({ vault: address, intervalSec: z.number().int().min(0).max(31_536_000) });
const setAllowedBody = z.object({
  vault: address,
  tokens: z.array(address).min(1).max(64),
  allowed: z.boolean(),
});

/** Read+validate a JSON body; returns parsed data or sends a 400. */
async function parseBody<T>(c: Context, schema: z.ZodType<T>) {
  const raw = await c.req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, res: c.json({ error: "invalid body", details: parsed.error.flatten() }, 400) };
  }
  return { ok: true as const, data: parsed.data };
}

/** Runs agentLiquidate on-chain, then returns the vault's USDC balance. */
async function defaultAgentLiquidateAndBalance(vaultAddr: `0x${string}`): Promise<bigint> {
  const agent = getAgentWallet();
  const hash = await agent.writeContract({
    address: vaultAddr,
    abi: USER_VAULT_TX_ABI,
    functionName: "agentLiquidate",
    args: [],
    chain: activeChain,
    account: agent.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return publicClient.readContract({
    address: as0x(TOKENS.USDC.address),
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [vaultAddr],
  }) as Promise<bigint>;
}

export type TxDeps = {
  agentLiquidateAndBalance?: (vaultAddr: `0x${string}`) => Promise<bigint>;
};

/** /api/users/me tx-preparation routes. The frontend signs the returned txs. */
export function makeTxRouter(auth: MiddlewareHandler<AuthVars>, deps: TxDeps = {}): Hono<AuthVars> {
  const agentLiquidateAndBalance = deps.agentLiquidateAndBalance ?? defaultAgentLiquidateAndBalance;
  const r = new Hono<AuthVars>();
  r.use("*", auth);

  r.post("/deploy-vault", async (c) => {
    // Deploy is the FIRST on-chain action: fresh Google/email (embedded) wallets
    // often have 0 MNT, so top up gas before the user signs, same as deposit/
    // withdraw. Wallet derived from auth (privyId), so no body needed.
    // Fully best-effort: a DB/funder hiccup must NEVER stop the user getting their tx.
    try {
      const user = await prisma.user.findUnique({
        where: { privyId: c.get("privyId") },
        select: { walletAddress: true },
      });
      if (user?.walletAddress) await tryEnsureGas(user.walletAddress as `0x${string}`);
    } catch (err) {
      log.warn({ err }, "deploy-vault gas top-up skipped (non-blocking)");
    }
    return c.json({ tx: tx.prepareDeployVault() });
  });

  r.post("/prepare-deposit", async (c) => {
    const p = await parseBody(c, depositBody);
    if (!p.ok) return p.res;
    const { vault, account, amount } = p.data;
    await tryEnsureGas(account as `0x${string}`);
    return c.json({
      steps: [
        tx.prepareApproveUsdc(vault as `0x${string}`, amount),
        tx.prepareDeposit(vault as `0x${string}`, account as `0x${string}`, amount),
      ],
    });
  });

  // 1-tx deposit: FE signs an EIP-2612 permit (Privy signTypedData), splits it, posts
  // here; we encode depositWithPermit. See FRONTEND_INTEGRATION.md for the typed data.
  r.post("/prepare-deposit-permit", async (c) => {
    const p = await parseBody(c, permitBody);
    if (!p.ok) return p.res;
    const { vault, account, amount, deadline, signature } = p.data;
    const sig = parseSignature(signature as `0x${string}`);
    const v = Number(sig.v ?? 27n + BigInt(sig.yParity ?? 0));
    await tryEnsureGas(account as `0x${string}`);
    return c.json({
      tx: tx.prepareDepositWithPermit(
        vault as `0x${string}`,
        account as `0x${string}`,
        amount,
        BigInt(deadline),
        v,
        sig.r,
        sig.s,
      ),
    });
  });

  r.post("/prepare-withdraw", async (c) => {
    const p = await parseBody(c, withdrawBody);
    if (!p.ok) return p.res;
    const { vault, account, amount } = p.data;

    const vaultAddr = vault as `0x${string}`;
    const ownerAddr = account as `0x${string}`;

    // ── 1. Gas top-up ─────────────────────────────────────────
    await tryEnsureGas(ownerAddr);

    // ── 2. Agent liquidates all non-USDC holdings → USDC, return actual balance ─
    // Pakai balance aktual, bukan totalAssets() — menghindari gap slippage
    const usdcBalance = await agentLiquidateAndBalance(vaultAddr);
    const usdcBalanceHuman = Number(usdcBalance) / 10 ** 6;

    // Clamp: jangan minta lebih dari USDC yang tersedia (0.1% buffer untuk slippage)
    const safeAmount = Math.min(amount, usdcBalanceHuman * 0.999);

    // ── 4. Return withdraw tx untuk user sign ─────────────────
    return c.json({ tx: tx.prepareWithdraw(vaultAddr, ownerAddr, safeAmount) });
  });

  r.post("/prepare-switch", async (c) => {
    const p = await parseBody(c, switchBody);
    if (!p.ok) return p.res;
    const { vault, strategyId, customAllocation } = p.data;
    const v = vault as `0x${string}`;
    const risk = riskLevelFromId(strategyId)!;

    if (risk === RISK_LEVEL.CUSTOM) {
      if (!customAllocation) {
        return c.json({ error: "customAllocation required for CUSTOM" }, 400);
      }
      const { lowBps, medBps, highBps } = customAllocation;
      if (lowBps + medBps + highBps !== 10_000) {
        return c.json({ error: "customAllocation must sum to 10000 bps" }, 400);
      }
      // setCustomAllocation already sets riskPreference=CUSTOM on-chain; calling
      // setRiskLevel(CUSTOM) reverts (InvalidAllocationSum), so it's the only step.
      return c.json({ steps: [tx.prepareSetCustomAllocation(v, lowBps, medBps, highBps)] });
    }
    return c.json({ steps: [tx.prepareSetRisk(v, risk)] });
  });

  // ── Agent control (BE-A): owner-signed on-chain controls ─────────────────────
  // NOTE: this is the HARD on-chain pause (emergencyPause). The soft "auto-rebalance
  // off" toggle is a DB flag at PATCH /agent/pause — keep them distinct; the FE picks.

  /** POST /api/users/me/prepare-pause — hard on-chain pause. */
  r.post("/prepare-pause", async (c) => {
    const p = await parseBody(c, pauseBody);
    if (!p.ok) return p.res;
    return c.json({
      tx: tx.prepareEmergencyPause(p.data.vault as `0x${string}`, p.data.reason ?? "Paused by owner"),
    });
  });

  /** POST /api/users/me/prepare-unpause — resume after an emergency pause. */
  r.post("/prepare-unpause", async (c) => {
    const p = await parseBody(c, unpauseBody);
    if (!p.ok) return p.res;
    return c.json({ tx: tx.prepareEmergencyUnpause(p.data.vault as `0x${string}`) });
  });

  /** POST /api/users/me/prepare-set-frequency — on-chain min interval between rebalances. */
  r.post("/prepare-set-frequency", async (c) => {
    const p = await parseBody(c, frequencyBody);
    if (!p.ok) return p.res;
    return c.json({
      tx: tx.prepareSetMinRebalanceInterval(p.data.vault as `0x${string}`, p.data.intervalSec),
    });
  });

  /** POST /api/users/me/prepare-set-allowed — add/remove tokens from the vault allow-list.
   *  Returns `steps` (allowed=true → 1 batch tx; allowed=false → one tx per token). */
  r.post("/prepare-set-allowed", async (c) => {
    const p = await parseBody(c, setAllowedBody);
    if (!p.ok) return p.res;
    const steps = tx.prepareSetAllowedTokens(
      p.data.vault as `0x${string}`,
      p.data.tokens as `0x${string}`[],
      p.data.allowed,
    );
    return c.json({ steps });
  });

  return r;
}

export const txRouter = makeTxRouter(requireAuth);
