import { create } from "zustand";

interface ChatStore {
  open: boolean;
  pendingMessage: string | null;
  openChat: (message?: string) => void;
  closeChat: () => void;
  consumePending: () => string | null;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  open: false,
  pendingMessage: null,
  openChat: (message) => set({ open: true, pendingMessage: message ?? null }),
  closeChat: () => set({ open: false }),
  consumePending: () => {
    const msg = get().pendingMessage;
    set({ pendingMessage: null });
    return msg;
  },
}));
