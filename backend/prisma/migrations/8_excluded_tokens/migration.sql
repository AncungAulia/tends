-- Per-user "Avoid" list — token symbols the agent must skip when allocating.
-- Read by projection + rebalancer to drop these from the target allocation.
ALTER TABLE "AgentConfig" ADD COLUMN "excludedTokens" TEXT[] NOT NULL DEFAULT '{}';
