-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "asset" TEXT NOT NULL,
    "priceWad" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("asset","snapshotAt")
);

-- CreateIndex
CREATE INDEX "PriceSnapshot_asset_snapshotAt_idx" ON "PriceSnapshot"("asset", "snapshotAt");
