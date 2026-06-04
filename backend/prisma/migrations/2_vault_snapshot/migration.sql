-- CreateTable
CREATE TABLE "VaultSnapshot" (
    "vaultAddress" TEXT NOT NULL,
    "totalAssets" DECIMAL(78,0) NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultSnapshot_pkey" PRIMARY KEY ("vaultAddress","snapshotAt")
);

-- CreateIndex
CREATE INDEX "VaultSnapshot_vaultAddress_snapshotAt_idx" ON "VaultSnapshot"("vaultAddress", "snapshotAt");
