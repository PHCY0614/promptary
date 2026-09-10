import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Store } from "./store";
import { mergeBackup, parseBackup, type BackupBundle } from "./backup";
import { ErrorCode, translateError, useLocale } from "./i18n";

export default function ImportBackup({ store }: { store: Store }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<BackupBundle | null>(null);
  const [message, setMessage] = useState<{ code: string; added?: number; skipped?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const preview = pending ? mergeBackup(store.collections, pending.collections) : null;

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuOpen]);

  // 僅讀取本機檔案；預覽不寫入，使用者確認後才提交至 IndexedDB。
  async function read(file?: File) {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); setPending(null); setMessage(null);
    try {
      if (file.size > 500 * 1024 * 1024) throw new Error(ErrorCode.importZipTooLarge);
      setPending(await parseBackup(file));
    } catch (error) {
      setMessage({ code: error instanceof Error ? error.message : ErrorCode.importReadFailed });
    } finally { lock.current = false; setBusy(false); }
  }
  async function submit() {
    if (!pending || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const result = await store.importData(pending);
      if (result) { setMessage({ code: "importComplete", added: result.added, skipped: result.skipped }); setPending(null); }
      else setMessage({ code: ErrorCode.importSaveFailed });
    } catch { setMessage({ code: ErrorCode.importFailed }); }
    finally { lock.current = false; setBusy(false); }
  }
  const flash = message
    ? message.code === "importComplete"
      ? t.importComplete(message.added ?? 0, message.skipped ?? 0)
      : translateError(message.code, t)
    : "";
  return <>
    <div ref={menuRef} className="relative z-40 shrink-0" onKeyDown={(e) => { if (e.key === "Escape") { setMenuOpen(false); (e.currentTarget.querySelector("button") as HTMLButtonElement | null)?.focus(); } }}>
      <button type="button" aria-haspopup="true" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)} className="whitespace-nowrap bg-[#161618] px-2.5 py-1.5 text-xs text-[#b8b5af] border border-[#2e2e32] rounded-lg">{t.manage} ▾</button>
      {menuOpen && <div className="absolute right-0 top-full mt-2 w-full rounded-lg border border-[#2e2e32] bg-[#161618] p-1 shadow-xl">
        <button type="button" onClick={() => { setMenuOpen(false); setOpen(true); setPending(null); setMessage(null); setFileName(""); }} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">{t.importAction}</button>
        <button type="button" onClick={() => { setMenuOpen(false); void store.exportData(); }} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">{t.exportAction}</button>
      </div>}
    </div>
    {/* Portal 脫離 header 的 backdrop-filter 定位範圍，視窗以整個螢幕置中。 */}
    {open && createPortal(<div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === "Escape" && !lock.current) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label={t.importBackup} className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-[#161618] border border-[#2e2e32] p-5 text-sm text-[#f0ede8]">
        <h2 className="mb-3 text-sm font-bold">{t.importBackup}</h2>
        <p className="text-xs text-[#b8b5af] mb-3">{t.importHelp}</p>
        <input ref={fileInput} aria-label={t.chooseBackupZip} type="file" accept=".zip,application/zip" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setFileName(file.name); void read(file); } e.target.value = ""; }} className="hidden" />
        <div className="flex flex-wrap items-center gap-3">
          <button autoFocus type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="shrink-0 rounded-lg border border-[#b8b5af] bg-[#303034] px-2.5 py-1.5 text-xs text-[#f0ede8] hover:bg-[#404046] disabled:opacity-50">{fileName ? t.changeFile : t.chooseBackupFile}</button>
          <span className="min-w-0 break-all text-xs text-[#b8b5af]">{fileName || t.noFileChosen}</span>
        </div>
        {preview && <p className="mt-4">{t.importPreview(pending!.collections.length, preview.added, preview.skipped)}</p>}
        {flash && <p role="status" className="mt-4 text-xs text-[#e1c48e]">{flash}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button disabled={busy} onClick={() => setOpen(false)} className="text-xs text-[#b8b5af] p-2">{t.close}</button>
          {pending && <button disabled={busy} onClick={() => void submit()} className="text-xs bg-[#c9a96e] text-black rounded px-3 py-2 disabled:opacity-50">{busy ? t.processing : t.confirmImport}</button>}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
