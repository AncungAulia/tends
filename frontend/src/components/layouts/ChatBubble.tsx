"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Chat } from "@/modules/chat/Chat";
import { useChatStore } from "@/hooks/useChatStore";

export function ChatBubble() {
  const { open, openChat, closeChat } = useChatStore();
  const [expanded, setExpanded] = useState(false);

  if (open) {
    return (
      <Chat
        onClose={() => { closeChat(); setExpanded(false); }}
        expanded={expanded}
        onToggleExpand={() => setExpanded((e) => !e)}
      />
    );
  }

  return (
    <button
      onClick={() => openChat()}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[#1591DC] px-4 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 max-md:bottom-20"
    >
      <MessageCircle size={18} />
      Tends Agent
    </button>
  );
}
