import { Hono } from "hono";
import { listStrategies, getStrategy } from "../../strategies.js";

export const strategiesRouter = new Hono();

strategiesRouter.get("/", (c) => c.json({ strategies: listStrategies() }));

strategiesRouter.get("/:id", (c) => {
  const s = getStrategy(c.req.param("id").toUpperCase());
  if (!s) return c.json({ error: "unknown strategy" }, 404);
  return c.json(s);
});
