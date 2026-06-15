/**
 * Show the actual Hermes DECIDE prompt for all 3 risk levels using live prices,
 * and run the LLM to get a real allocation decision.
 *
 *   fly ssh console --app tends-api -C "node dist/scripts/test-hermes-prompt.js"
 */

import { Agent } from "@mastra/core/agent";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { PRICE_FEED_ABI } from "../chain/abis.js";
import { TOKENS, type TokenSymbol } from "../chain/tokens.js";
import { currentApy } from "../services/projection.js";
import {
  buildStrategyPrompt,
  STRATEGY_SYSTEM_PROMPT,
  validateAllocation,
} from "../services/strategy-prompt.js";
import { hermesModel } from "../agents/mastra/hermes-model.js";

const hermesDecider = new Agent({
  id: "test-decider",
  name: "Test Decider",
  instructions: STRATEGY_SYSTEM_PROMPT,
  model: hermesModel,
});

async function fetchLivePrices(): Promise<Partial<Record<TokenSymbol, number>>> {
  const pf = as0x(addresses.priceFeed);
  const prices: Partial<Record<TokenSymbol, number>> = {};

  await Promise.all(
    Object.values(TOKENS)
      .filter((t) => t.address && t.address.length === 42)
      .map(async (t) => {
        try {
          const [priceWad] = await publicClient.readContract({
            address: pf,
            abi: PRICE_FEED_ABI,
            functionName: "getPriceUnsafe",
            args: [as0x(t.address)],
          });
          if (priceWad > 0n) prices[t.symbol] = Number(priceWad) / 1e18;
        } catch {
          // skip
        }
      }),
  );

  return prices;
}

async function runDecide(
  riskLevel: "LOW" | "MEDIUM" | "HIGH",
  prices: Partial<Record<TokenSymbol, number>>,
) {
  const apy = currentApy() as Partial<Record<TokenSymbol, number>>;

  const prompt = buildStrategyPrompt({
    holdings: [],
    totalValueUsd: 1000,
    prices,
    apy,
    riskLevel,
  });

  console.log(`\n${"=".repeat(80)}`);
  console.log(`PROMPT [${riskLevel}]`);
  console.log("=".repeat(80));
  console.log(prompt);

  console.log(`\n${"─".repeat(80)}`);
  console.log(`HERMES RESPONSE [${riskLevel}]`);
  console.log("─".repeat(80));

  const result = await hermesDecider.generate([{ role: "user", content: prompt }]);
  const raw = await result.text;
  const cleaned = raw.replace(/^```[\w]*\n?/m, "").replace(/```$/m, "").trim();

  let parsed: { reasoning: string; allocation: Record<string, number> };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.log("RAW (not JSON):", raw);
    return;
  }

  console.log("Reasoning:", parsed.reasoning);
  console.log("\nAllocation:");

  const sorted = Object.entries(parsed.allocation ?? {}).sort(([, a], [, b]) => b - a);
  console.log(
    ["Token".padEnd(12), "Allocation%".padEnd(14), "Price USD".padEnd(14), "Category"].join(""),
  );
  console.log("-".repeat(60));
  for (const [sym, pct] of sorted) {
    const price = prices[sym as TokenSymbol] ?? 0;
    const priceStr = price >= 1000 ? `$${Math.round(price)}` : price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(6)}`;
    const cat = Object.entries(
      (await import("../chain/tokens.js")).TOKENS_BY_CATEGORY,
    ).find(([, tokens]) => tokens.some((t) => t.symbol === sym))?.[0] ?? "?";
    console.log(`${sym.padEnd(12)}${String(pct + "%").padEnd(14)}${priceStr.padEnd(14)}${cat}`);
  }
  console.log(`${"─".repeat(60)}`);
  console.log(`Total: ${Object.values(parsed.allocation ?? {}).reduce((a, b) => a + b, 0)}%`);

  const validation = validateAllocation(parsed.allocation, prices, riskLevel);
  console.log(validation.valid ? "✅ VALID allocation" : `❌ INVALID: ${validation.errors.join("; ")}`);

  return parsed;
}

async function main() {
  console.log("Fetching live prices from PriceFeed...");
  const prices = await fetchLivePrices();
  const priceCount = Object.keys(prices).length;
  console.log(`Got ${priceCount} live prices`);

  if (priceCount === 0) {
    console.error("No prices available — check PriceFeed address or relayer");
    process.exit(1);
  }

  await runDecide("LOW",    prices);
  await runDecide("MEDIUM", prices);
  await runDecide("HIGH",   prices);

  console.log("\n=== Done ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
