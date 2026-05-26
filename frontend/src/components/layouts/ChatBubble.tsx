"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Chat } from "@/modules/chat/Chat";

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Chat positions itself (fixed). Collapsed = floating bottom-right panel;
  // expanded = fills the content area (right of the sidebar).
  if (open) {
    return (
      <Chat
        onClose={() => {
          setOpen(false);
          setExpanded(false);
        }}
        expanded={expanded}
        onToggleExpand={() => setExpanded((e) => !e)}
      />
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[#1591DC] px-4 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 max-md:bottom-20"
    >
      <MessageCircle size={18} />
      Hermes AI
    </button>
  );
}
