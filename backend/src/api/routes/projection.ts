import { Hono } from "hono";
import { z } from "zod";
import { projectForRisk } from "../../services/projection.js";
import { riskLevelFromId } from "../../strategies.js";

const bpsField = z.number().int().min(0).max(10_000);

export const projectionBodySchema = z.object({
  strategyId: z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]),
  capital: z.number().positive(),
  durationDays: z.number().int().positive(),
  customAllocation: z
    .object({ lowBps: bpsField, medBps: bpsField, highBps: bpsField })
    .optional(),
});

export const projectionRouter = new Hono();

projectionRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = projectionBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid body", details: parsed.error.flatten() }, 400);
  }
  const { strategyId, capital, durationDays, customAllocation } = parsed.data;
  if (strategyId === "CUSTOM" && !customAllocation) {
    return c.json({ error: "customAllocation required for CUSTOM" }, 400);
  }
  const risk = riskLevelFromId(strategyId)!;
  try {
    return c.json(projectForRisk(risk, capital, durationDays, undefined, customAllocation));
  } catch (e) {
    // e.g. custom bps don't sum to 10000
    return c.json({ error: (e as Error).message }, 400);
  }
});
