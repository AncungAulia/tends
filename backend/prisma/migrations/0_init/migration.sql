-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "walletAddress" TEXT NOT NULL,
    "privyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "Vault" (
    "address" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "riskPreference" INTEGER NOT NULL DEFAULT 1,
    "lowBps" INTEGER,
    "medBps" INTEGER,
    "highBps" INTEGER,
    "shares" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "initialDeposit" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "deployedBlock" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" BIGSERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApyHistory" (
    "asset" TEXT NOT NULL,
    "apy" DECIMAL(10,4) NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApyHistory_pkey" PRIMARY KEY ("asset","snapshotAt")
);

-- CreateTable
CREATE TABLE "AgentActivity" (
    "id" BIGSERIAL NOT NULL,
    "vaultAddress" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "txHash" TEXT,
    "blockNumber" BIGINT,
    "agentAddress" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasTopUp" (
    "id" BIGSERIAL NOT NULL,
    "recipient" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GasTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerState" (
    "key" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_owner_key" ON "Vault"("owner");

-- CreateIndex
CREATE INDEX "ChatMessage_walletAddress_createdAt_idx" ON "ChatMessage"("walletAddress", "createdAt");

-- CreateIndex
CREATE INDEX "ApyHistory_asset_snapshotAt_idx" ON "ApyHistory"("asset", "snapshotAt");

-- CreateIndex
CREATE INDEX "AgentActivity_vaultAddress_timestamp_idx" ON "AgentActivity"("vaultAddress", "timestamp");

-- CreateIndex
CREATE INDEX "AgentActivity_txHash_idx" ON "AgentActivity"("txHash");

-- CreateIndex
CREATE INDEX "GasTopUp_recipient_timestamp_idx" ON "GasTopUp"("recipient", "timestamp");

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_owner_fkey" FOREIGN KEY ("owner") REFERENCES "User"("walletAddress") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "User"("walletAddress") ON DELETE CASCADE ON UPDATE CASCADE;

