import { Hono } from "hono";
import { listStrategies, getStrategy } from "../../strategies.js";
import { apyService } from "../../services/apy.js";

export const strategiesRouter = new Hono();

strategiesRouter.get("/", async (c) => {
  const apy = await apyService.getApyMap(); // derived where available, else estimate
  return c.json({ strategies: listStrategies(apy) });
});

strategiesRouter.get("/:id", async (c) => {
  const apy = await apyService.getApyMap();
  const s = getStrategy(c.req.param("id").toUpperCase(), apy);
  if (!s) return c.json({ error: "unknown strategy" }, 404);
  return c.json(s);
});
