import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import { txExecutorService as tx } from "../../services/tx-executor.js";
import { gasFunderService } from "../../services/gas-funder.js";
import { riskLevelFromId } from "../../strategies.js";
import { RISK_LEVEL } from "../../chain/tokens.js";
import { env } from "../../config/env.js";
import { childLogger } from "../../lib/logger.js";
import { requireAuth, type AuthVars } from "../auth.js";

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
const amount = z.number().positive();
const bps = z.number().int().min(0).max(10_000);

const depositBody = z.object({ vault: address, account: address, amount });
const withdrawBody = depositBody;
const switchBody = z.object({
  vault: address,
  strategyId: z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]),
  customAllocation: z
    .object({ lowBps: bps, medBps: bps, highBps: bps })
    .optional(),
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

/** /api/users/me tx-preparation routes. The frontend signs the returned txs. */
export function makeTxRouter(auth: MiddlewareHandler<AuthVars>): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.use("*", auth);

  r.post("/deploy-vault", (c) => c.json({ tx: tx.prepareDeployVault() }));

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

  r.post("/prepare-withdraw", async (c) => {
    const p = await parseBody(c, withdrawBody);
    if (!p.ok) return p.res;
    const { vault, account, amount } = p.data;
    await tryEnsureGas(account as `0x${string}`);
    return c.json({ tx: tx.prepareWithdraw(vault as `0x${string}`, account as `0x${string}`, amount) });
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

  return r;
}

export const txRouter = makeTxRouter(requireAuth);
