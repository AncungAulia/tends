// Always call the PROXY addresses. ABIs are taken from the implementation
// contracts (see lib/abis/*). Network: Mantle Sepolia (chainId 5003).
export const ADDRESSES = {
  VAULT_FACTORY: "0x279B31B00F64C0ce85BCe2Bd7e377CdcAE58d400",
  PRICE_FEED: "0x7F37687840d238fBE7Ff2E66AD9ed458fa689A2A",
  ACTIVITY_LOG: "0x864f888330821b6025b2FE670f30E01Ee8776449",
  STRATEGY_ROUTER: "0xb2f36070E6eae3353E8e755172B477DF213ae248",
} as const;

// Primary deposit asset
export const USDC_ADDRESS =
  "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD" as const;
export const USDC_DECIMALS = 6;

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;
