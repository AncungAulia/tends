-- Onboarding profile fields: goal (safe/steady/max), riskTolerance (out/wait/add),
-- and onboardedAt timestamp set once when the user completes onboarding.
ALTER TABLE "User" ADD COLUMN "goal"          TEXT;
ALTER TABLE "User" ADD COLUMN "riskTolerance" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardedAt"   TIMESTAMP(3);
