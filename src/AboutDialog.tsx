import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "./i18n";

export type AboutMode = "intro" | "full";

export const INTRO_SEEN_KEY = "promptary_intro_seen";

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, "true");
  } catch {
    /* private mode or blocked storage: skip */
  }
}

interface Props {
  open: boolean;
  mode?: AboutMode;
  onClose: () => void;
}

export default function AboutDialog({ open, mode = "full", onClose }: Props) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="w-full max-w-2xl max-h-[75dvh] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-surface border border-border p-5 text-sm text-text"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2
            id="about-title"
            className="text-xl font-semibold text-text leading-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {t.about}
          </h2>
          <button ref={closeButton} type="button" onClick={onClose} className="text-xs text-text-muted p-2">
            {t.close}
          </button>
        </div>

        <div className="space-y-4 text-sm leading-relaxed text-text-body">
          {t.aboutIntro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <ol className="list-decimal space-y-2 pl-5">
            {t.aboutSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <section>
            <h3 className="mb-2 text-sm font-bold text-text">{t.aboutReminderTitle}</h3>
            <div className="space-y-3">
              {t.aboutReminder.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          {mode === "full" && <section>
            <h3 className="mb-2 text-sm font-bold text-text">{t.aboutWhyTitle}</h3>
            <div className="space-y-3">
              {t.aboutWhy.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>}

          {mode === "full" && <section>
            <h3 className="mb-2 text-sm font-bold text-text">{t.aboutMeTitle}</h3>
            <div className="space-y-3">
              <p>{t.aboutMeKaomoji}</p>
              {t.aboutMe.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p>
                {/* Threads */}
                <a
                  href={t.aboutThreadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Threads"
                  title="Threads"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-social text-white transition-opacity hover:opacity-80"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161" />
                  </svg>
                </a>
              </p>
            </div>
          </section>}
        </div>
      </section>
    </div>,
    document.body
  );
}
