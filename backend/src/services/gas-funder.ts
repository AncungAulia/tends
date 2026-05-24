import { childLogger } from "../lib/logger.js";

const log = childLogger("gas-funder");

/**
 * Auto top-up user wallets with MNT so user-initiated txs have gas
 * (docs/01-ARCHITECTURE.md §4, docs §A.5). Uses PRIVATE_KEY_GAS_FUNDER.
 *
 * TODO:
 *  - init viem/ethers wallet client from env.PRIVATE_KEY_GAS_FUNDER
 *  - ensureGasFunded(wallet): if balance < 0.05 MNT, send 0.1 MNT
 *  - record each top-up in prisma.gasTopUp
 *  - getMonthlyTopUpStats()
 */
export class GasFunderService {
  async ensureGasFunded(userWallet: string): Promise<void> {
    log.warn({ userWallet }, "ensureGasFunded not implemented (stub)");
  }
}

export const gasFunderService = new GasFunderService();
