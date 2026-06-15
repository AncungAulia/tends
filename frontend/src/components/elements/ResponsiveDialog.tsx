"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/utils/cn";

interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Block dismiss (e.g. mid-transaction). */
  locked?: boolean;
  children: React.ReactNode;
  className?: string;
}

const PANEL =
  "border border-[#DDE8F2] bg-white dark:border-white/10 dark:bg-[#0F2035]";

/**
 * Centered modal on desktop (Radix Dialog) · bottom sheet on mobile (vaul Drawer).
 * Both trap focus, dismiss on Escape, and expose proper dialog semantics.
 */
export function ResponsiveDialog({
  open,
  onClose,
  title,
  locked,
  children,
  className,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const onOpenChange = (next: boolean) => {
    if (!next && !locked) onClose();
  };

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={!locked}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-[#0C1A2B]/40 backdrop-blur-sm dark:bg-black/60" />
          <Drawer.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[92vh] flex-col rounded-t-2xl p-6 pb-8",
              PANEL,
              className,
            )}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full bg-[#DDE8F2] dark:bg-white/15" />
            <Drawer.Title
              className={cn(
                "mb-4 font-sans text-lg font-semibold text-[#0C1A2B] dark:text-white",
                !title && "sr-only",
              )}
            >
              {title ?? "Dialog"}
            </Drawer.Title>
            <div className="overflow-y-auto">{children}</div>
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
          onEscapeKeyDown={(e) => locked && e.preventDefault()}
          onInteractOutside={(e) => locked && e.preventDefault()}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(95vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl focus:outline-none",
            PANEL,
            className,
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title
              className={cn(
                "font-sans text-lg font-semibold text-[#0C1A2B] dark:text-white",
                !title && "sr-only",
              )}
            >
              {title ?? "Dialog"}
            </Dialog.Title>
            {!locked && (
              <Dialog.Close
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center text-[#5B7490] transition-colors hover:text-[#0C1A2B] focus:outline-none focus:ring-2 focus:ring-[#1591DC]/40 dark:hover:text-white"
              >
                <X size={18} />
              </Dialog.Close>
            )}
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
