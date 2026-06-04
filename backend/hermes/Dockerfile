# Hermes Agent gateway (Python) + the Tends MCP server (Node subprocess it spawns).
# Build context = backend/ ; dockerfilePath = hermes/Dockerfile.

# ── Stage 1: build our Node MCP server ───────────────────────────────────────
FROM node:22-slim AS mcpbuild
WORKDIR /app
# openssl → Prisma detects debian-openssl-3.0.x at generate (no fallback warning).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate && pnpm build

# ── Stage 2: Hermes (Python) + Node runtime for the MCP subprocess ───────────
FROM python:3.12-slim AS hermes
WORKDIR /app

# Node 22 (so Hermes can spawn `node dist/mcp/server.js`) + openssl for Prisma.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates openssl \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# Hermes Agent — pin a version in production once you've verified it.
# [mcp] = the Python MCP SDK, REQUIRED for Hermes to connect to our `tends` MCP
# server (without it `hermes mcp test` fails "requires the 'mcp' Python SDK").
# aiohttp is required for the OpenAI-compatible API server adapter (`hermes gateway`).
RUN pip install --no-cache-dir 'hermes-agent[mcp]' aiohttp

# The Tends MCP server + its deps (Prisma client) and schema.
COPY --from=mcpbuild /app/node_modules ./node_modules
COPY --from=mcpbuild /app/dist ./dist
COPY --from=mcpbuild /app/prisma ./prisma

# Hermes config seeded by the entrypoint into the persistent /root/.hermes volume
# (so the Copilot OAuth credential in auth.json survives recreates).
COPY hermes/config.yaml /opt/hermes/config.yaml
COPY hermes/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# API_SERVER_HOST must be :: (IPv6) — Fly's private 6PN network is IPv6-only, so
# binding 0.0.0.0 (IPv4) makes <app>.internal connections reset. :: is dual-stack.
ENV API_SERVER_ENABLED=true \
    API_SERVER_HOST=:: \
    API_SERVER_PORT=8642 \
    PYTHONUNBUFFERED=1
EXPOSE 8642

CMD ["/usr/local/bin/entrypoint.sh"]
