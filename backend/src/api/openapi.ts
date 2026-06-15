/**
 * Hand-authored OpenAPI 3.1 spec for the Tends backend.
 *
 * This documents the REAL endpoints mounted in `src/index.ts` and defined in
 * `src/api/routes/*.ts`. It is intentionally hand-written (not generated from the
 * route zod schemas) so the existing routes stay untouched. Keep it in sync with
 * the route files when endpoints change.
 *
 * Served at:
 *   GET /openapi.json  → this object as JSON
 *   GET /docs          → Scalar API reference UI pointed at /openapi.json
 */

const bearerAuth = [{ bearerAuth: [] as string[] }];

/** Loosely-typed so we don't need a full OpenAPI types dependency. */
export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Tends Backend API",
    version: "0.1.0",
    description:
      "AI-managed RWA yield aggregator on Mantle. Public endpoints (health, strategies, " +
      "projection, apy) need no auth; most /api/users/me/*, chat, and chat-sessions " +
      "endpoints require a Privy access token as a Bearer credential.",
  },
  servers: [{ url: "/", description: "This server" }],
  tags: [
    { name: "System", description: "Health / liveness" },
    { name: "Strategies", description: "Public strategy catalog + projections" },
    { name: "APY", description: "Historical APY series" },
    { name: "Auth", description: "Privy session ↔ wallet association" },
    { name: "Users", description: "Authenticated per-user position / activity / pnl / profile" },
    { name: "Transactions", description: "Prepare on-chain txs for the frontend to sign" },
    { name: "Agent", description: "Per-vault agent config, guardrails, run-now, holdings, portfolio, preferences" },
    { name: "Chat", description: "Hermes / action chat agents (SSE streaming)" },
    { name: "Chat Sessions", description: "Chat thread list / history / delete" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Privy access token (ES256 JWT). Sent as `Authorization: Bearer <token>`.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      Allocation: {
        type: "object",
        description: "Custom allocation in basis points; the three fields must sum to 10000.",
        properties: {
          lowBps: { type: "integer", minimum: 0, maximum: 10000 },
          medBps: { type: "integer", minimum: 0, maximum: 10000 },
          highBps: { type: "integer", minimum: 0, maximum: 10000 },
        },
        required: ["lowBps", "medBps", "highBps"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Liveness + DB/chain status",
        description: "Public. Returns service status, DB reachability, chain id, and mock-contract flag.",
        responses: {
          "200": {
            description: "Service status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    db: { type: "string", enum: ["up", "down"] },
                    chainId: { type: "integer" },
                    mockContracts: { type: "boolean" },
                    ts: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/strategies": {
      get: {
        tags: ["Strategies"],
        summary: "List strategies with live APY",
        description: "Public. Returns the strategy catalog, each annotated with a derived/estimated APY.",
        responses: {
          "200": {
            description: "Strategy list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { strategies: { type: "array", items: { type: "object" } } },
                },
              },
            },
          },
        },
      },
    },
    "/api/strategies/{id}": {
      get: {
        tags: ["Strategies"],
        summary: "Get a single strategy by id",
        description: "Public. `id` is case-insensitive (LOW | MEDIUM | HIGH | CUSTOM).",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", example: "LOW" } },
        ],
        responses: {
          "200": { description: "The strategy", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "Unknown strategy", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/api/projection": {
      post: {
        tags: ["Strategies"],
        summary: "Project returns for a strategy + capital + duration",
        description: "Public. For strategyId=CUSTOM you must also pass customAllocation (bps summing to 10000).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  strategyId: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CUSTOM"] },
                  capital: { type: "number", description: "Positive, ≤ 1e12" },
                  durationDays: { type: "integer", description: "Positive integer, ≤ 36500" },
                  customAllocation: { $ref: "#/components/schemas/Allocation" },
                },
                required: ["strategyId", "capital", "durationDays"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Projection result", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Invalid body / bad allocation", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/api/apy/history": {
      get: {
        tags: ["APY"],
        summary: "Historical APY series for an asset",
        description: "Public. Returns the APY snapshots for `asset` over the last `days`.",
        parameters: [
          { name: "asset", in: "query", required: true, schema: { type: "string", example: "mETH" } },
          { name: "days", in: "query", required: false, schema: { type: "integer", default: 30 } },
        ],
        responses: {
          "200": {
            description: "APY history",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    asset: { type: "string" },
                    days: { type: "integer" },
                    history: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "400": { description: "Missing asset / invalid days", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/api/auth/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify Privy session + associate wallet",
        description: "Auth required. Verifies the bearer token and upserts the user with the given wallet.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
                required: ["walletAddress"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Verified",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { privyId: { type: "string" }, walletAddress: { type: "string" } },
                },
              },
            },
          },
          "400": { description: "Invalid body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Missing / invalid token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/api/users/me/position": {
      get: {
        tags: ["Users"],
        summary: "Authenticated user's vault position",
        security: bearerAuth,
        responses: {
          "200": { description: "Vault position", content: { "application/json": { schema: { type: "object", properties: { vault: { type: "object", nullable: true } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/activity": {
      get: {
        tags: ["Users"],
        summary: "Agent activity for the user's vault",
        security: bearerAuth,
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 50, minimum: 1, maximum: 200 } },
        ],
        responses: {
          "200": { description: "Activity list", content: { "application/json": { schema: { type: "object", properties: { activities: { type: "array", items: { type: "object" } } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/pnl": {
      get: {
        tags: ["Users"],
        summary: "PnL value time-series for the chart",
        description: "Auth required. `range` is one of 7d|30d|90d|1y; or pass `days=N` (≤365). Default 30d.",
        security: bearerAuth,
        parameters: [
          { name: "range", in: "query", required: false, schema: { type: "string", enum: ["7d", "30d", "90d", "1y"] } },
          { name: "days", in: "query", required: false, schema: { type: "integer", maximum: 365 } },
        ],
        responses: {
          "200": {
            description: "PnL series",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    vault: { type: "string", nullable: true },
                    initialDepositUsd: { type: "number" },
                    points: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/profile": {
      get: {
        tags: ["Users"],
        summary: "Get profile (name + wallet)",
        security: bearerAuth,
        responses: {
          "200": { description: "Profile", content: { "application/json": { schema: { type: "object", properties: { walletAddress: { type: "string", nullable: true }, name: { type: "string", nullable: true } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Update display name",
        description: "Auth required. Saves the user's display name (1–50 chars), e.g. after onboarding.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 50 } }, required: ["name"] },
            },
          },
        },
        responses: {
          "200": { description: "Saved", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, name: { type: "string" } } } } } },
          "400": { description: "Invalid name", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/api/users/me/deploy-vault": {
      post: {
        tags: ["Transactions"],
        summary: "Prepare the deploy-vault tx",
        description: "Auth required. Returns an unsigned tx the frontend signs to deploy the user's vault.",
        security: bearerAuth,
        responses: {
          "200": { description: "Unsigned tx", content: { "application/json": { schema: { type: "object", properties: { tx: { type: "object" } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/prepare-deposit": {
      post: {
        tags: ["Transactions"],
        summary: "Prepare approve + deposit txs",
        description: "Auth required. Returns a 2-step tx sequence (USDC approve, then deposit).",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  vault: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  account: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  amount: { type: "number", minimum: 0.000001, maximum: 1000000000000 },
                },
                required: ["vault", "account", "amount"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Tx steps", content: { "application/json": { schema: { type: "object", properties: { steps: { type: "array", items: { type: "object" } } } } } } },
          "400": { description: "Invalid body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/prepare-deposit-permit": {
      post: {
        tags: ["Transactions"],
        summary: "Prepare a 1-tx deposit using an EIP-2612 permit",
        description: "Auth required. The FE signs an EIP-2612 permit and posts it here; returns a single depositWithPermit tx.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  vault: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  account: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  amount: { type: "number", minimum: 0.000001, maximum: 1000000000000 },
                  deadline: { type: "integer", description: "Unix seconds" },
                  signature: { type: "string", pattern: "^0x[0-9a-fA-F]{130}$", description: "65-byte signature" },
                },
                required: ["vault", "account", "amount", "deadline", "signature"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Unsigned tx", content: { "application/json": { schema: { type: "object", properties: { tx: { type: "object" } } } } } },
          "400": { description: "Invalid body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/prepare-withdraw": {
      post: {
        tags: ["Transactions"],
        summary: "Prepare a withdraw tx (agent liquidates first)",
        description:
          "Auth required. The agent liquidates non-USDC holdings to USDC on-chain, then returns a clamped withdraw tx.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  vault: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  account: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  amount: { type: "number", minimum: 0.000001, maximum: 1000000000000 },
                },
                required: ["vault", "account", "amount"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Unsigned withdraw tx", content: { "application/json": { schema: { type: "object", properties: { tx: { type: "object" } } } } } },
          "400": { description: "Invalid body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/prepare-switch": {
      post: {
        tags: ["Transactions"],
        summary: "Prepare a strategy/risk switch tx",
        description:
          "Auth required. Returns tx steps to set the risk level, or a setCustomAllocation step when strategyId=CUSTOM (bps must sum to 10000).",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  vault: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                  strategyId: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CUSTOM"] },
                  customAllocation: { $ref: "#/components/schemas/Allocation" },
                },
                required: ["vault", "strategyId"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Tx steps", content: { "application/json": { schema: { type: "object", properties: { steps: { type: "array", items: { type: "object" } } } } } } },
          "400": { description: "Invalid body / bad allocation", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/api/users/me/agent-config": {
      get: {
        tags: ["Agent"],
        summary: "Get agent config / guardrails for the user's vault",
        security: bearerAuth,
        responses: {
          "200": { description: "Agent config", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "No vault deployed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Agent"],
        summary: "Update agent config / guardrails",
        description: "Auth required. All fields optional; updates guardrails and re-enforces caps if now violated.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  autoRebalanceEnabled: { type: "boolean" },
                  cadenceSec: { type: "integer", nullable: true },
                  driftThresholdBps: { type: "integer", minimum: 0, maximum: 10000, nullable: true },
                  maxSlippageBps: { type: "integer", minimum: 0, maximum: 5000 },
                  perTokenCapsBps: { type: "object", additionalProperties: { type: "integer", minimum: 0, maximum: 10000 }, nullable: true },
                  notes: { type: "string", maxLength: 1000, nullable: true },
                  maxPerAssetPct: { type: "integer", minimum: 1, maximum: 100, nullable: true },
                  dailyLimitPerDay: { type: "integer", minimum: 1, maximum: 100, nullable: true },
                  stopLossEnabled: { type: "boolean" },
                  stopLossPct: { type: "integer", minimum: 1, maximum: 100, nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Saved config", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Invalid body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "No vault deployed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/agent/pause": {
      patch: {
        tags: ["Agent"],
        summary: "Pause auto-rebalancing",
        security: bearerAuth,
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "No vault deployed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/agent/resume": {
      patch: {
        tags: ["Agent"],
        summary: "Resume auto-rebalancing",
        security: bearerAuth,
        responses: {
          "200": { description: "Updated", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "No vault deployed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/agent/run-now": {
      post: {
        tags: ["Agent"],
        summary: "Trigger a rebalance run immediately",
        security: bearerAuth,
        responses: {
          "200": { description: "Run result", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "No vault deployed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/agent/run-hermes": {
      post: {
        tags: ["Agent"],
        summary: "Run the LLM-driven Hermes rebalancer workflow",
        security: bearerAuth,
        responses: {
          "200": { description: "Run result", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "No vault deployed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/agent/log/stream": {
      get: {
        tags: ["Agent"],
        summary: "Live agent log (Server-Sent Events)",
        description: "Auth required. SSE stream of real-time agent activity for the user's vault. Emits `connected`, `entry`, and `ping` events.",
        security: bearerAuth,
        responses: {
          "200": { description: "SSE stream", content: { "text/event-stream": { schema: { type: "string" } } } },
          "404": { description: "No vault deployed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/agent-log": {
      get: {
        tags: ["Agent"],
        summary: "Recent agent run log entries",
        security: bearerAuth,
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
        ],
        responses: {
          "200": { description: "Log entries", content: { "application/json": { schema: { type: "object", properties: { activities: { type: "array", items: { type: "object" } } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/holdings": {
      get: {
        tags: ["Agent"],
        summary: "On-chain holdings for the user's vault",
        security: bearerAuth,
        responses: {
          "200": { description: "Holdings", content: { "application/json": { schema: { type: "object", properties: { holdings: { type: "array", items: { type: "object" } }, totalValueUsd: { type: "string" } } } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/portfolio": {
      get: {
        tags: ["Agent"],
        summary: "Portfolio snapshot (value, deposit, pnl, holdings)",
        security: bearerAuth,
        responses: {
          "200": {
            description: "Portfolio snapshot",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalValueUsd: { type: "number" },
                    initialDepositUsd: { type: "number" },
                    pnlUsd: { type: "number" },
                    pnlPct: { type: "number" },
                    holdings: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/users/me/preferences": {
      get: {
        tags: ["Agent"],
        summary: "Get per-user UI preferences",
        security: bearerAuth,
        responses: {
          "200": { description: "Preferences object", content: { "application/json": { schema: { type: "object" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      put: {
        tags: ["Agent"],
        summary: "Replace per-user UI preferences",
        description: "Auth required. Body is an arbitrary JSON object stored as the user's preferences.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
        },
        responses: {
          "200": { description: "Saved preferences", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Invalid body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/api/chat": {
      post: {
        tags: ["Chat"],
        summary: "Hermes read+advisory agent (SSE streaming)",
        description:
          "Auth required. Streams the Hermes agent reply over Server-Sent Events (`text`, `status`, `done`, `error` events). The acted-on wallet is bound from the Privy session, never the message.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", minLength: 1 },
                  thread: { type: "string", description: "Conversation thread id (optional)" },
                  isNew: { type: "boolean", description: "Persist a new titled thread" },
                  title: { type: "string", description: "Title for a new thread" },
                },
                required: ["message"],
              },
            },
          },
        },
        responses: {
          "200": { description: "SSE stream", content: { "text/event-stream": { schema: { type: "string" } } } },
          "400": { description: "Invalid body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/chat-v2": {
      post: {
        tags: ["Chat"],
        summary: "gpt-4o action agent (reads AND executes, SSE streaming)",
        description:
          "Auth required. Same request/response shape as /api/chat, but backed by the action agent that can both read and execute guardrail changes. Streams over SSE.",
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", minLength: 1 },
                  thread: { type: "string" },
                  isNew: { type: "boolean" },
                  title: { type: "string" },
                },
                required: ["message"],
              },
            },
          },
        },
        responses: {
          "200": { description: "SSE stream", content: { "text/event-stream": { schema: { type: "string" } } } },
          "400": { description: "Invalid body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/api/chat-sessions": {
      get: {
        tags: ["Chat Sessions"],
        summary: "List chat sessions for the user",
        security: bearerAuth,
        responses: {
          "200": {
            description: "Session list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          title: { type: "string" },
                          updatedAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/chat-sessions/{threadId}": {
      get: {
        tags: ["Chat Sessions"],
        summary: "Get message history for a session",
        security: bearerAuth,
        parameters: [
          { name: "threadId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Messages",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    messages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: { type: "string", enum: ["user", "hermes"] },
                          text: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Chat Sessions"],
        summary: "Delete a chat session",
        security: bearerAuth,
        parameters: [
          { name: "threadId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Deleted", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } } },
          "500": { description: "Delete failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openapiSpec;
