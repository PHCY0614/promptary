import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "./i18n";

interface GuardOptions {
  isDirty: boolean;
  isBusy: boolean;
  onClose: () => void;
}

export function useModalCloseGuard({ isDirty, isBusy, onClose }: GuardOptions) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (isBusy) return;
    if (!isDirty) {
      onClose();
      return;
    }
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmationOpen(true);
  }, [isBusy, isDirty, onClose]);

  const continueEditing = useCallback(() => {
    setConfirmationOpen(false);
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  const discardChanges = useCallback(() => {
    setConfirmationOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (confirmationOpen) {
        continueEditing();
        return;
      }
      requestClose();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [confirmationOpen, continueEditing, requestClose]);

  return { confirmationOpen, requestClose, continueEditing, discardChanges };
}

interface ConfirmationProps {
  open: boolean;
  onContinueEditing: () => void;
  onDiscard: () => void;
}

export function UnsavedChangesDialog({ open, onContinueEditing, onDiscard }: ConfirmationProps) {
  const { t } = useLocale();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description"
        className="relative z-10 w-full max-w-xs rounded-xl border border-[#2e2e32] bg-[#161618] shadow-2xl"
      >
        <div className="border-b border-[#1e1e21] px-4 py-3">
          <h2 id="unsaved-changes-title" className="text-sm font-bold text-[#f0ede8]" style={{ fontFamily: "'Fraunces', serif" }}>
            {t.unsavedChangesTitle}
          </h2>
        </div>
        <p id="unsaved-changes-description" className="px-4 py-3 text-xs text-[#c8c4bc]">
          {t.discardChangesPrompt}
        </p>
        <div className="flex items-center justify-end gap-2 border-t border-[#1e1e21] px-4 py-3">
          <button
            type="button"
            autoFocus
            onClick={onContinueEditing}
            className="rounded-lg bg-[#c9a96e] px-3 py-2 text-xs font-medium text-[#0d0d0e] transition-colors hover:bg-[#d4b87e]"
          >
            {t.continueEditing}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-3 py-2 text-xs text-[#b8b5af] transition-colors hover:text-[#e06e6e]"
          >
            {t.discardChanges}
          </button>
        </div>
      </section>
    </div>
  );
}
