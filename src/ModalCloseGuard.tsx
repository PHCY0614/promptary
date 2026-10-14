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
        className="relative z-10 w-full max-w-xs rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div className="border-b border-border-subtle px-4 py-3">
          <h2 id="unsaved-changes-title" className="text-sm font-bold text-text" style={{ fontFamily: "'Fraunces', serif" }}>
            {t.unsavedChangesTitle}
          </h2>
        </div>
        <p id="unsaved-changes-description" className="px-4 py-3 text-xs text-text-body">
          {t.discardChangesPrompt}
        </p>
        <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            autoFocus
            onClick={onContinueEditing}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            {t.continueEditing}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-3 py-2 text-xs text-text-muted transition-colors hover:text-danger"
          >
            {t.discardChanges}
          </button>
        </div>
      </section>
    </div>
  );
}
