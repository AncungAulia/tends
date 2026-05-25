# Hermes Agent gateway (Python) + the Tends MCP server (Node subprocess it spawns).
# Build context = backend/ ; dockerfilePath = hermes/Dockerfile.

# ── Stage 1: build our Node MCP server ───────────────────────────────────────
FROM node:22-slim AS mcpbuild
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate && pnpm build

# ── Stage 2: Hermes (Python) + Node runtime for the MCP subprocess ───────────
FROM python:3.12-slim AS hermes
WORKDIR /app

# Node 22 (so Hermes can spawn `node dist/mcp/server.js`)
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# Hermes Agent — pin a version in production once you've verified it.
# aiohttp is required for the OpenAI-compatible API server adapter (`hermes gateway`).
RUN pip install --no-cache-dir hermes-agent aiohttp

# The Tends MCP server + its deps (Prisma client) and schema.
COPY --from=mcpbuild /app/node_modules ./node_modules
COPY --from=mcpbuild /app/dist ./dist
COPY --from=mcpbuild /app/prisma ./prisma

# Hermes config (model + MCP registration). Secrets come from env at runtime.
COPY hermes/config.yaml /root/.hermes/config.yaml

ENV API_SERVER_ENABLED=true \
    API_SERVER_HOST=0.0.0.0 \
    API_SERVER_PORT=8642 \
    PYTHONUNBUFFERED=1
EXPOSE 8642

CMD ["hermes", "gateway"]
