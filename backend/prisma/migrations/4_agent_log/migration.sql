-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "vaultAddress" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentLog_vaultAddress_ts_idx" ON "AgentLog"("vaultAddress", "ts");
