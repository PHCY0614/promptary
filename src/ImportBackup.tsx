import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Collection } from "./types";
import type { Store } from "./store";
import { mergeBackup, parseBackup } from "./backup";

export default function ImportBackup({ store }: { store: Store }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Collection[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const menuRef = useRef<HTMLDetailsElement>(null);
  const preview = pending ? mergeBackup(store.collections, pending) : null;

  // 僅讀取本機檔案；預覽不寫入，使用者確認後才提交至 IndexedDB。
  async function read(file?: File) {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); setPending(null); setMessage("");
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("目前單份匯入上限為 100 MB，請選擇較小的備份。");
      setPending(parseBackup(await file.text()));
    } catch (error) {
      setMessage(error instanceof SyntaxError ? "無法解析 JSON，請選擇完整的備份檔案。" : error instanceof Error ? error.message : "讀取失敗，請重新選擇檔案。");
    } finally { lock.current = false; setBusy(false); }
  }
  async function submit() {
    if (!pending || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const result = await store.importData(pending);
      if (result) { setMessage(`匯入完成：新增 ${result.added} 筆，跳過 ${result.skipped} 筆。`); setPending(null); }
      else setMessage("儲存失敗，原有收藏未變更。可關閉其他分頁或釋出儲存空間後重試；備份預覽仍保留。");
    } catch { setMessage("匯入失敗，請重試。"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <details ref={menuRef} className="relative shrink-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.open = false; }} onKeyDown={(e) => { if (e.key === "Escape" && menuRef.current) menuRef.current.open = false; }}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden whitespace-nowrap bg-[#161618] px-2.5 py-1.5 text-xs text-[#b8b5af] border border-[#2e2e32] rounded-lg">管理 ▾</summary>
      <div className="absolute right-0 top-full mt-2 w-full rounded-lg border border-[#2e2e32] bg-[#161618] p-1 shadow-xl">
        <button onClick={() => { if (menuRef.current) menuRef.current.open = false; setOpen(true); setPending(null); setMessage(""); setFileName(""); }} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">匯入</button>
        <button onClick={() => { if (menuRef.current) menuRef.current.open = false; store.exportData(); }} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">匯出</button>
      </div>
    </details>
    {/* Portal 脫離 header 的 backdrop-filter 定位範圍，視窗以整個螢幕置中。 */}
    {open && createPortal(<div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === "Escape" && !lock.current) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="匯入備份" className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-[#161618] border border-[#2e2e32] p-5 text-sm text-[#f0ede8]">
        <h2 className="mb-3 text-sm font-bold">匯入備份</h2>
        <p className="text-xs text-[#b8b5af] mb-3">選擇 Promptary 匯出的 JSON（上限 100 MB）。相同收藏 ID 會跳過，不覆蓋現有版本。</p>
        <input ref={fileInput} aria-label="選擇備份 JSON" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setFileName(file.name); void read(file); } e.target.value = ""; }} className="hidden" />
        <div className="flex flex-wrap items-center gap-3">
          <button autoFocus type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="shrink-0 rounded-lg border border-[#b8b5af] bg-[#303034] px-2.5 py-1.5 text-xs text-[#f0ede8] hover:bg-[#404046] disabled:opacity-50">{fileName ? "更換檔案" : "選擇備份檔案"}</button>
          <span className="min-w-0 break-all text-xs text-[#b8b5af]">{fileName || "尚未選擇檔案"}</span>
        </div>
        {preview && <p className="mt-4">共 {pending!.length} 筆收藏：將新增 {preview.added} 筆，跳過 {preview.skipped} 筆。</p>}
        {message && <p role="status" className="mt-4 text-xs text-[#e1c48e]">{message}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button disabled={busy} onClick={() => setOpen(false)} className="text-xs text-[#b8b5af] p-2">關閉</button>
          {pending && <button disabled={busy} onClick={() => void submit()} className="text-xs bg-[#c9a96e] text-black rounded px-3 py-2 disabled:opacity-50">{busy ? "處理中…" : "確認匯入"}</button>}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
