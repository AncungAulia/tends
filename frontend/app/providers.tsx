"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { http } from "viem";
import { mantleSepolia, RPC_URL } from "@/lib/chains";

const wagmiConfig = createConfig({
  chains: [mantleSepolia],
  transports: {
    // Coalesce JSON-RPC calls made within 60ms into a single HTTP request —
    // the public Mantle Sepolia RPC is rate-limited (429s otherwise).
    [mantleSepolia.id]: http(RPC_URL, {
      batch: { wait: 60 },
    }),
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 12_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 10_000),
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={{
          defaultChain: mantleSepolia,
          supportedChains: [mantleSepolia],
          loginMethods: ["wallet", "email", "google"],
          appearance: {
            theme: "light",
            accentColor: "#1591DC",
          },
          // Privy v3: createOnLogin moved under embeddedWallets.ethereum
          embeddedWallets: {
            // v3 equivalent of v2's `noPromptOnSignature` — suppress the per-tx
            // wallet confirmation popup so multi-step signing (deposit = approve
            // + deposit) flows back-to-back without interruptions.
            showWalletUIs: false,
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            {children}
            <Toaster position="bottom-center" theme="light" richColors />
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </ThemeProvider>
  );
}
