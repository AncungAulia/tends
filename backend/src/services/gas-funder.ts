import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { childLogger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { publicClient, activeChain } from "../chain/index.js";
import { as0x } from "../chain/addresses.js";
import { prisma } from "../db/client.js";

const log = childLogger("gas-funder");

export const GAS_THRESHOLD = parseEther("0.05"); // top up below this
export const GAS_TOPUP = parseEther("0.1"); // amount per top-up

/** Pure: does this MNT balance need a top-up? */
export const needsTopUp = (balance: bigint, threshold = GAS_THRESHOLD): boolean =>
  balance < threshold;

export interface GasFunderDeps {
  getBalance(wallet: `0x${string}`): Promise<bigint>;
  sendTopUp(to: `0x${string}`, amount: bigint): Promise<`0x${string}`>;
  recordTopUp(to: `0x${string}`, amount: bigint, hash: string): Promise<void>;
}

export const defaultGasFunderDeps: GasFunderDeps = {
  getBalance: (wallet) => publicClient.getBalance({ address: wallet }),
  async sendTopUp(to, amount) {
    if (!env.PRIVATE_KEY_GAS_FUNDER) throw new Error("PRIVATE_KEY_GAS_FUNDER not set");
    const account = privateKeyToAccount(as0x(env.PRIVATE_KEY_GAS_FUNDER));
    const wallet = createWalletClient({ account, chain: activeChain, transport: http(env.MANTLE_RPC_URL) });
    return wallet.sendTransaction({ account, chain: activeChain, to, value: amount });
  },
  async recordTopUp(to, amount, hash) {
    await prisma.gasTopUp.create({ data: { recipient: to, amount: amount.toString(), txHash: hash } });
  },
};

/**
 * Auto-tops up user wallets with MNT so user-signed txs have gas
 * (docs/01 §4, docs §A.5). Uses a dedicated funder EOA (PRIVATE_KEY_GAS_FUNDER).
 */
export class GasFunderService {
  constructor(private readonly deps: GasFunderDeps = defaultGasFunderDeps) {}

  /** Top up `wallet` if below threshold. Returns the tx hash, or null if not needed. */
  async ensureGasFunded(wallet: `0x${string}`): Promise<`0x${string}` | null> {
    const balance = await this.deps.getBalance(wallet);
    if (!needsTopUp(balance)) return null;
    const hash = await this.deps.sendTopUp(wallet, GAS_TOPUP);
    await this.deps.recordTopUp(wallet, GAS_TOPUP, hash);
    log.info({ wallet, hash }, "gas topped up");
    return hash;
  }
}

export const gasFunderService = new GasFunderService();
