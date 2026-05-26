import { z } from "zod";
import { listStrategies, riskLevelFromId } from "../strategies.js";
import { projectForRisk } from "../services/projection.js";
import { txExecutorService as tx } from "../services/tx-executor.js";
import { RISK_LEVEL } from "../chain/tokens.js";

/** Tool result shape Hermes/MCP expects. */
export interface ToolResult {
  content: { type: "text"; text: string }[];
}

export interface McpTool {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (raw: unknown) => Promise<ToolResult>;
}

/** Data-access the read tools need (injected; Prisma-backed in production). */
export interface ToolDeps {
  position(walletAddress: string): Promise<unknown>;
  activity(walletAddress: string): Promise<unknown>;
  apyHistory(asset: string, days: number): Promise<unknown>;
}

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

function tool<S extends z.ZodRawShape>(
  name: string,
  description: string,
  shape: S,
  run: (args: z.infer<z.ZodObject<S>>) => Promise<unknown> | unknown,
): McpTool {
  return {
    name,
    description,
    schema: shape,
    handler: async (raw) => ok(await run(z.object(shape).parse(raw))),
  };
}

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid address");
const strategyId = z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]);
const customAllocation = z
  .object({ lowBps: z.number(), medBps: z.number(), highBps: z.number() })
  .optional();

/**
 * Tools exposed to the Hermes portfolio assistant. Read tools take injected deps;
 * compute/tx tools reuse the (pure, already-tested) services directly.
 */
export function buildTools(deps: ToolDeps): McpTool[] {
  return [
    tool("readUserPosition", "Read a user's vault position by wallet address.",
      { walletAddress: address }, ({ walletAddress }) => deps.position(walletAddress)),

    tool("getAgentActivity", "Recent agent activity for a user's vault.",
      { walletAddress: address }, ({ walletAddress }) => deps.activity(walletAddress)),

    tool("listStrategies", "List the strategies (LOW/MEDIUM/HIGH/CUSTOM) with blended APY.",
      {}, () => listStrategies()),

    tool("getApyHistory", "Historical APY series for an asset.",
      { asset: z.string(), days: z.number().int().positive().default(30) },
      ({ asset, days }) => deps.apyHistory(asset, days)),

    tool("computeProjection", "Project future value for a strategy over a duration.",
      { strategyId, capital: z.number().positive(), durationDays: z.number().int().positive(), customAllocation },
      ({ strategyId, capital, durationDays, customAllocation }) =>
        projectForRisk(riskLevelFromId(strategyId)!, capital, durationDays, undefined, customAllocation)),

    tool("prepareDepositTx", "Prepare deposit (approve + deposit) txs for the user to sign.",
      { vault: address, account: address, amount: z.number().positive() },
      ({ vault, account, amount }) => ({
        steps: [
          tx.prepareApproveUsdc(vault as `0x${string}`, amount),
          tx.prepareDeposit(vault as `0x${string}`, account as `0x${string}`, amount),
        ],
      })),

    tool("prepareWithdrawTx", "Prepare a withdraw tx for the user to sign.",
      { vault: address, account: address, amount: z.number().positive() },
      ({ vault, account, amount }) => ({
        tx: tx.prepareWithdraw(vault as `0x${string}`, account as `0x${string}`, amount),
      })),

    tool("prepareSwitchTx", "Prepare strategy-switch txs (setRiskLevel, + allocation for CUSTOM).",
      { vault: address, strategyId, customAllocation },
      ({ vault, strategyId, customAllocation }) => {
        const v = vault as `0x${string}`;
        const risk = riskLevelFromId(strategyId)!;
        if (risk === RISK_LEVEL.CUSTOM) {
          if (!customAllocation) throw new Error("customAllocation required for CUSTOM");
          const { lowBps, medBps, highBps } = customAllocation;
          if (lowBps + medBps + highBps !== 10_000) throw new Error("customAllocation must sum to 10000");
          // setCustomAllocation sets risk=CUSTOM; setRiskLevel(CUSTOM) would revert.
          return { steps: [tx.prepareSetCustomAllocation(v, lowBps, medBps, highBps)] };
        }
        return { steps: [tx.prepareSetRisk(v, risk)] };
      }),
  ];
}
