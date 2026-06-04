import "./lib/json-bigint.js"; // BigInt → string in JSON (must load before any serialize)
import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { env } from "./config/env.js";
import { childLogger } from "./lib/logger.js";
import { prisma } from "./db/client.js";
import { startScheduler, stopScheduler } from "./scheduler.js";
import { indexerService } from "./services/indexer.js";
import { wsHub } from "./ws/hub.js";
import { strategiesRouter } from "./api/routes/strategies.js";
import { projectionRouter } from "./api/routes/projection.js";
import { usersRouter } from "./api/routes/users.js";
import { txRouter } from "./api/routes/tx.js";
import { authRouter } from "./api/routes/auth.js";
import { apyRouter } from "./api/routes/apy.js";
import { chatRouter } from "./api/routes/chat.js";
import { chatV2Router } from "./api/routes/chat-v2.js";
import { rateLimit } from "./api/rate-limit.js";

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

app.use("/api/*", rateLimit);

app.route("/api/auth", authRouter);
app.route("/api/strategies", strategiesRouter);
app.route("/api/projection", projectionRouter);
app.route("/api/apy", apyRouter);
app.route("/api/chat", chatRouter);
app.route("/api/chat-v2", chatV2Router); // PoC: Mastra agent (Hermes model + Supabase memory)
app.route("/api/users/me", usersRouter);
app.route("/api/users/me", txRouter);
// TODO: WS /ws/dashboard

let stopIndexer: (() => void) | undefined;

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log.info(`🚀 Tends backend listening on http://localhost:${info.port}`);
  startScheduler();
  if (env.INDEXER_ENABLED) stopIndexer = indexerService.startWatching();
});

// Dashboard WebSocket — clients receive broadcast on-chain events (see ws/hub.ts).
const wss = new WebSocketServer({ server: server as unknown as Server, path: "/ws/dashboard" });
wss.on("connection", (ws) => {
  const client = { send: (d: string) => ws.send(d) };
  wsHub.add(client);
  ws.on("close", () => wsHub.remove(client));
  ws.on("error", () => wsHub.remove(client));
  ws.send(JSON.stringify({ type: "connected" }));
});

const shutdown = async (signal: string) => {
  log.info({ signal }, "shutting down");
  stopScheduler();
  stopIndexer?.();
  wss.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export { app };
