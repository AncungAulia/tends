import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { env } from "./config/env.js";
import { childLogger } from "./lib/logger.js";
import { prisma } from "./db/client.js";
import { startScheduler, stopScheduler } from "./scheduler.js";
import { strategiesRouter } from "./api/routes/strategies.js";
import { projectionRouter } from "./api/routes/projection.js";
import { usersRouter } from "./api/routes/users.js";

const log = childLogger("server");

const app = new Hono();

app.use("*", honoLogger());
app.use("*", cors());

app.get("/health", async (c) => {
  let db = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    db = "down";
  }
  return c.json({
    status: "ok",
    db,
    chainId: env.CHAIN_ID,
    mockContracts: env.USE_MOCK_CONTRACTS,
    ts: new Date().toISOString(),
  });
});

app.route("/api/strategies", strategiesRouter);
app.route("/api/projection", projectionRouter);
app.route("/api/users/me", usersRouter);
// TODO: /api/chat (Hermes SSE), /api/apy/history, WS /ws/dashboard

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log.info(`🚀 Tends backend listening on http://localhost:${info.port}`);
  startScheduler();
});

const shutdown = async (signal: string) => {
  log.info({ signal }, "shutting down");
  stopScheduler();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export { app };
