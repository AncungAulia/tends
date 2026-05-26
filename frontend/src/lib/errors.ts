import { ContractFunctionExecutionError, BaseError } from "viem";

export type TendsError =
  | "VaultAlreadyExists"
  | "VaultPaused"
  | "ZeroAmount"
  | "InvalidAllocationSum"
  | "NotAuthorizedAgent"
  | "RebalanceTooSoon"
  | "TokenNotAllowed"
  | "NoFeedConfigured"
  | "StalePrice"
  | "unknown";

const MESSAGES: Record<string, string> = {
  VaultAlreadyExists: "You already have a vault.",
  VaultPaused:
    "Vault is paused. Deposits are unavailable, withdrawals remain open.",
  ZeroAmount: "Amount cannot be zero.",
  InvalidAllocationSum: "Custom allocation must total exactly 100%.",
  NotAuthorizedAgent: "Only the Hermes agent can perform a rebalance.",
  RebalanceTooSoon: "A rebalance was just performed. Try again later.",
  TokenNotAllowed: "This token is not allowed for swaps in the vault.",
  NoFeedConfigured: "This token has no configured price feed yet.",
  StalePrice: "Price data is being updated by the oracle.",
};

export function parseTendsError(err: unknown): {
  type: TendsError;
  message: string;
} {
  if (err instanceof BaseError) {
    const cause = err.walk(
      (e) => e instanceof ContractFunctionExecutionError,
    );
    if (cause instanceof ContractFunctionExecutionError) {
      const name = cause.cause?.name ?? "";
      if (name in MESSAGES) {
        return { type: name as TendsError, message: MESSAGES[name] };
      }
    }
    // User rejected the request in their wallet
    if (/user rejected|denied/i.test(err.shortMessage ?? err.message)) {
      return { type: "unknown", message: "Request cancelled in wallet." };
    }
  }

  return { type: "unknown", message: "Something went wrong. Please try again." };
}
