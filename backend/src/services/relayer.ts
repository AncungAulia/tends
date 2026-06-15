import { parseUnits, stringToHex } from "viem";
import * as redstone from "@redstone-finance/sdk";
import { childLogger } from "../lib/logger.js";
import { env } from "../config/env.js";
import {
  mainnetPublicClient,
  getAgentWallet,
  activeChain,
} from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { MOCK_ORACLE_ABI, USDY_ORACLE_ABI } from "../chain/abis.js";
import { REDSTONE_FEEDS, RATE_TIMES_ETH } from "../chain/redstone-feeds.js";

const log = childLogger("relayer");

export interface FeedEntry {
  id: string; // MockOracle key
  wad: bigint; // 18-dec value
  human: number;
}

/**
 * Float → 18-decimal bigint. Rounds to 8 decimals first: that's RedStone's native
 * precision, and it strips float64 noise that `toFixed(18)` would otherwise bake
 * into the low digits (e.g. (1.05).toFixed(18) === "1.050000000000000044").
 */
export const toWad = (n: number): bigint => parseUnits(n.toFixed(8), 18);

/** MockOracle feedId key as bytes32 (right-padded), matching ethers formatBytes32String. */
export const feedKey = (id: string): `0x${string}` => stringToHex(id, { size: 32 });

/**
 * Pure transform: raw RedStone values (sourceId → human float) → MockOracle entries.
 * mETH/cmETH are ETH-denominated rates on RedStone, so we multiply by ETH price to
 * store a USD value. Missing sources are skipped (logged).
 */
export function buildRedstoneEntries(
  raw: Record<string, number>,
  feeds: Record<string, string> = REDSTONE_FEEDS,
  rateTimesEth: ReadonlySet<string> = RATE_TIMES_ETH,
): FeedEntry[] {
  const ethPrice = raw["ETH"];
  const out: FeedEntry[] = [];
  for (const [mockKey, srcId] of Object.entries(feeds)) {
    const base = raw[srcId];
    if (base === undefined) {
      log.warn({ mockKey, srcId }, "source not in response, skip");
      continue;
    }
    let value = base;
    if (rateTimesEth.has(mockKey)) {
      if (ethPrice === undefined) {
        log.warn({ mockKey }, "no ETH price for USD conversion, skip");
        continue;
      }
      value = base * ethPrice;
    }
    out.push({ id: mockKey, wad: toWad(value), human: value });
  }
  return out;
}

// Dependencies, injectable for tests.
export interface RelayerDeps {
  /** sourceIds → { sourceId: humanValue } from RedStone. */
  fetchRedstoneRaw: (sourceIds: string[]) => Promise<Record<string, number>>;
  /** USDY price (18-dec) from the Ondo mainnet oracle. */
  fetchUsdyWad: () => Promise<bigint>;
  /** Push a batch to MockOracle; resolves to the tx hash. */
  pushPrices: (
    ids: readonly `0x${string}`[],
    values: readonly bigint[],
  ) => Promise<`0x${string}`>;
}

const sdk = redstone as unknown as {
  getSignersForDataServiceId: (id: string) => string[];
  requestDataPackages: (opts: {
    dataServiceId: string;
    dataPackagesIds: string[];
    uniqueSignersCount: number;
    authorizedSigners: string[];
  }) => Promise<
    Record<
      string,
      { dataPackage: { dataPoints: { toObj: () => { value: number } }[] } }[]
    >
  >;
};

export const defaultRelayerDeps: RelayerDeps = {
  async fetchRedstoneRaw(sourceIds) {
    const signers = sdk.getSignersForDataServiceId(env.REDSTONE_DATA_SERVICE_ID);
    const res = await sdk.requestDataPackages({
      dataServiceId: env.REDSTONE_DATA_SERVICE_ID,
      dataPackagesIds: sourceIds,
      uniqueSignersCount: 1,
      authorizedSigners: signers,
    });
    const raw: Record<string, number> = {};
    for (const srcId of sourceIds) {
      const v = res[srcId]?.[0]?.dataPackage?.dataPoints?.[0]?.toObj().value;
      if (typeof v === "number") raw[srcId] = v;
    }
    return raw;
  },
  async fetchUsdyWad() {
    return mainnetPublicClient.readContract({
      address: as0x(env.USDY_ORACLE_ADDRESS),
      abi: USDY_ORACLE_ABI,
      functionName: "getPrice",
    });
  },
  async pushPrices(ids, values) {
    const wallet = getAgentWallet();
    return wallet.writeContract({
      address: as0x(addresses.mockOracle),
      abi: MOCK_ORACLE_ABI,
      functionName: "setPrices",
      args: [ids as `0x${string}`[], values as bigint[]],
      chain: activeChain,
      account: wallet.account!,
    });
  },
};

/**
 * Price relayer (handed off to the backend — RELAYER-HANDOFF.md). Mirrors real
 * mainnet/RedStone prices into the testnet MockOracle so PriceFeed.getPrice serves
 * them. Signed by AGENT_EXECUTOR (authorized via MockOracle.setRelayer).
 *
 * Ported from ~/rwa-oracle/script/relayer.cjs (ethers v5 → viem). Run always-on via
 * the scheduler (RELAYER_ENABLED), or one-shot with `pnpm relayer:once`.
 */
export class RelayerService {
  constructor(private readonly deps: RelayerDeps = defaultRelayerDeps) {}

  /** Collect all feed entries (USDY + RedStone) without sending. */
  async collectEntries(): Promise<FeedEntry[]> {
    const sourceIds = [...new Set(Object.values(REDSTONE_FEEDS))];
    const [raw, usdyWad] = await Promise.all([
      this.deps.fetchRedstoneRaw(sourceIds),
      this.deps.fetchUsdyWad(),
    ]);
    const usdy: FeedEntry = {
      id: "USDY",
      wad: usdyWad,
      human: Number(usdyWad) / 1e18,
    };
    return [usdy, ...buildRedstoneEntries(raw)];
  }

  /** One relay cycle: collect all sources, push batch to MockOracle. */
  async relayOnce(): Promise<`0x${string}` | null> {
    if (!addresses.mockOracle) {
      log.warn("MOCK_ORACLE_ADDRESS not set, skip");
      return null;
    }
    const entries = await this.collectEntries();
    if (entries.length === 0) return null;

    const hash = await this.deps.pushPrices(
      entries.map((e) => feedKey(e.id)),
      entries.map((e) => e.wad),
    );
    log.info({ hash, count: entries.length }, "relayed prices → MockOracle");
    return hash;
  }
}

export const relayerService = new RelayerService();
