"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Modal built on the native <dialog> element: focus trapping, Escape to close and
 * inert background come from the browser. Sized to fit small screens (sheet on mobile).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-3xl border border-line bg-surface p-0 text-ivory shadow-2xl open:animate-fade-up",
        "sm:m-auto sm:max-w-lg sm:rounded-3xl",
        "max-h-[min(90dvh,760px)]",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[min(90dvh,760px)] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 id={titleId} className="font-display text-2xl leading-tight">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-full p-2 text-muted transition-colors hover:bg-white/5 hover:text-ivory"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
