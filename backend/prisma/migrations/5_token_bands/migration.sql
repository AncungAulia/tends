-- Per-token drift band: { "cmETH": { "min": 2000, "max": 3000 } } in bps.
-- When a holding's allocation exits its band, the agent rebalances it back to target.
ALTER TABLE "AgentConfig" ADD COLUMN "perTokenBandsBps" JSONB;
