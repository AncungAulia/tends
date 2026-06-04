-- AlterTable
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;

-- CreateTable
CREATE TABLE "AgentConfig" (
    "vaultAddress" TEXT NOT NULL,
    "autoRebalanceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cadenceSec" INTEGER,
    "driftThresholdBps" INTEGER,
    "maxSlippageBps" INTEGER NOT NULL DEFAULT 100,
    "perTokenCapsBps" JSONB,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("vaultAddress")
);
