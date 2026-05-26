import { create } from "zustand";

interface VaultState {
  /** Cached vault proxy address for the connected user (or undefined). */
  vaultAddress?: `0x${string}`;
  setVaultAddress: (address?: `0x${string}`) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  vaultAddress: undefined,
  setVaultAddress: (address) => set({ vaultAddress: address }),
}));
