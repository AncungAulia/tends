-- Honest per-cycle agent log: one row per processVault call (HOLD, SKIP, REBALANCE, etc.).
CREATE TABLE "AgentRun" (
  "id"           BIGSERIAL PRIMARY KEY,
  "vaultAddress" TEXT NOT NULL,
  "kind"         TEXT NOT NULL,
  "outcome"      TEXT NOT NULL,
  "driftBps"     INTEGER,
  "details"      JSONB NOT NULL,
  "startedAt"    TIMESTAMP(3) NOT NULL,
  "finishedAt"   TIMESTAMP(3) NOT NULL
);

CREATE INDEX "AgentRun_vaultAddress_startedAt_idx" ON "AgentRun"("vaultAddress", "startedAt");
