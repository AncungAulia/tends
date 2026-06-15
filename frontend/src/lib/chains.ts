import { type Chain } from "viem";

// Override with a dedicated endpoint via NEXT_PUBLIC_RPC_URL (the public RPC is
// rate-limited). Falls back to the public Mantle Sepolia RPC.
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.sepolia.mantle.xyz";

export const mantleSepolia: Chain = {
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "Mantlescan",
      url: "https://explorer.sepolia.mantle.xyz",
    },
  },
  testnet: true,
};
