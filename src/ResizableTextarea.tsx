import { useRef, type PointerEvent as ReactPointerEvent, type TextareaHTMLAttributes } from "react";
import { useLocale } from "./i18n";

export default function ResizableTextarea({ className = "", disabled, style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { t } = useLocale();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function setHeight(height: number) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const minimum = Math.max(56, Number.parseFloat(getComputedStyle(textarea).minHeight) || 0);
    textarea.style.height = `${Math.min(window.innerHeight * 0.4, Math.max(minimum, height))}px`;
  }

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = textarea.getBoundingClientRect().height;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => setHeight(startHeight + moveEvent.clientY - startY);
    const finish = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  }

  return (
    <div className="relative">
      <textarea ref={textareaRef} disabled={disabled} className={`resize-none pr-8 ${className}`} style={{ ...style, maxHeight: "40vh" }} {...props} />
      <button
        type="button"
        aria-label={t.resizeHandle}
        title={t.resizeHint}
        disabled={disabled}
        onPointerDown={startResize}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const height = textareaRef.current?.getBoundingClientRect().height ?? 0;
          setHeight(height + (event.key === "ArrowDown" ? 16 : -16));
        }}
        className="absolute bottom-1 right-1 flex h-5 w-5 touch-none cursor-ns-resize items-center justify-center rounded text-[#77747c] transition-colors hover:bg-[#242427] hover:text-[#c8c4bc] focus-visible:outline-1 focus-visible:outline-[#c9a96e] disabled:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round">
          <path d="m8 15 7-7M11.5 15l3.5-3.5" />
        </svg>
      </button>
    </div>
  );
}
