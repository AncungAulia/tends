"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/utils/cn";

interface ResponsiveSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const PANEL =
  "border-[#DDE8F2] bg-white dark:border-white/10 dark:bg-[#0F2035]";

/**
 * Right slide-over on desktop (Radix Dialog) · full-height bottom sheet on mobile
 * (vaul Drawer). Used for the Strategy panel.
 */
export function ResponsiveSheet({ open, onClose, title, children }: ResponsiveSheetProps) {
  const isMobile = useIsMobile();
  const onOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const Header = (
    <div className="flex items-center justify-between border-b border-[#DDE8F2] px-6 py-4 dark:border-white/10">
      <span className="font-sans text-lg font-semibold text-[#0C1A2B] dark:text-white">
        {title}
      </span>
      <button
        onClick={onClose}
        aria-label="Close"
        className="flex h-8 w-8 items-center justify-center text-[#5B7490] transition-colors hover:text-[#0C1A2B] focus:outline-none focus:ring-2 focus:ring-[#1591DC]/40 dark:hover:text-white"
      >
        <X size={18} />
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-[#0C1A2B]/40 backdrop-blur-sm dark:bg-black/60" />
          <Drawer.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-[92vh] flex-col rounded-t-2xl border-t",
              PANEL,
            )}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[#DDE8F2] dark:bg-white/15" />
            <Drawer.Title className="sr-only">{title ?? "Panel"}</Drawer.Title>
            {Header}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0C1A2B]/40 backdrop-blur-sm dark:bg-black/60" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l shadow-2xl focus:outline-none",
            PANEL,
          )}
        >
          <Dialog.Title className="sr-only">{title ?? "Panel"}</Dialog.Title>
          {Header}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
