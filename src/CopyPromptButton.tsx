import { useEffect, useRef, useState } from "react";

// ── 統一複製操作：等待剪貼簿成功才提示，短暫顯示後恢復 ──
export default function CopyPromptButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setStatus("idle");
    return () => clearTimeout(timer.current);
  }, [text]);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
    }
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => void copy()}
        title={status === "copied" ? "已複製" : "複製 Prompt"}
        aria-label={status === "copied" ? "已複製 Prompt" : "複製 Prompt"}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#b8b5af] hover:bg-[#272729] hover:text-[#c9a96e] transition-colors">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {status === "copied" ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></>}
        </svg>
      </button>
      <span role="status" className="sr-only">{status === "copied" ? "已複製 Prompt" : ""}</span>
      {status === "error" && (
        <div role="alert" className="absolute right-0 top-full z-20 w-64 rounded-lg border border-[#2e2e32] bg-[#161618] p-3 text-xs text-[#c8c4bc]">
          <div className="mb-2 flex justify-between gap-2">
            <span>複製失敗，可重試或手動選取。</span>
            <button onClick={() => setStatus("idle")} aria-label="關閉複製錯誤提示">×</button>
          </div>
          <textarea readOnly aria-label="手動複製 Prompt" value={text} onFocus={(event) => event.currentTarget.select()} className="w-full rounded bg-[#0d0d0e] p-2" />
        </div>
      )}
    </div>
  );
}
