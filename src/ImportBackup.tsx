import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Store } from "./store";
import { mergeBackup, parseBackup, type BackupBundle } from "./backup";
import { ErrorCode, translateError, useLocale } from "./i18n";
import { formatStorageUsage, readLocalStorageStatus, type LocalStorageStatus } from "./storagePersistence";

type Dialog = "import" | "clear" | "storage" | null;

export default function ImportBackup({ store }: { store: Store }) {
  const { locale, t } = useLocale();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, setPending] = useState<BackupBundle | null>(null);
  const [message, setMessage] = useState<{ code: string; added?: number; updated?: number; kept?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [storageStatus, setStorageStatus] = useState<LocalStorageStatus | null>(null);
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const manageButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const preview = pending ? mergeBackup(store.collections, pending.collections) : null;

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuOpen]);

  useEffect(() => {
    if (dialog !== "storage") return;
    let active = true;
    setStorageStatus(null);
    void readLocalStorageStatus().then((status) => {
      if (active) setStorageStatus(status);
    });
    return () => { active = false; };
  }, [dialog]);

  function openDialog(next: Exclude<Dialog, null>) {
    setMenuOpen(false);
    setDialog(next);
    if (next === "import") {
      setPending(null);
      setMessage(null);
      setFileName("");
    }
  }

  function closeDialog() {
    if (lock.current) return;
    setDialog(null);
    requestAnimationFrame(() => manageButton.current?.focus());
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { closeDialog(); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])"
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

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

  async function submitImport() {
    if (!pending || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const result = await store.importData(pending);
      if (result) {
        setMessage({ code: "importComplete", added: result.added, updated: result.updated, kept: result.kept });
        setPending(null);
      } else setMessage({ code: ErrorCode.importSaveFailed });
    } catch {
      setMessage({ code: ErrorCode.importFailed });
    } finally { lock.current = false; setBusy(false); }
  }

  async function submitClear() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (await store.clearData()) {
        setDialog(null);
        requestAnimationFrame(() => manageButton.current?.focus());
      }
    } finally { lock.current = false; setBusy(false); }
  }

  const flash = message
    ? message.code === "importComplete"
      ? t.importComplete(message.added ?? 0, message.updated ?? 0, message.kept ?? 0)
      : translateError(message.code, t)
    : "";
  const storageUsed = formatStorageUsage(storageStatus?.usage ?? null, locale);

  return <>
    <div ref={menuRef} className="relative z-40 shrink-0" onKeyDown={(event) => {
      if (event.key === "Escape") { setMenuOpen(false); manageButton.current?.focus(); }
    }}>
      <button ref={manageButton} type="button" aria-haspopup="true" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)} className="whitespace-nowrap bg-[#161618] px-2.5 py-1.5 text-xs text-[#b8b5af] border border-[#2e2e32] rounded-lg">
        {t.manage}{" "}<span aria-hidden="true" className={`inline-block text-[14px] transition-transform duration-150 motion-reduce:transition-none ${menuOpen ? "rotate-180" : ""}`}>▾</span>
      </button>
      {menuOpen && <div className="absolute right-0 top-full mt-1 min-w-full rounded-lg border border-[#2e2e32] bg-[#161618] p-1 shadow-xl">
        <button type="button" onClick={() => { setMenuOpen(false); void store.exportData(); }} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">{t.exportAction}</button>
        <button type="button" onClick={() => openDialog("import")} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">{t.importAction}</button>
        <button type="button" onClick={() => openDialog("clear")} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f19b9b] hover:bg-[#2e2e32] rounded">{t.clearAction}</button>
        <button type="button" onClick={() => openDialog("storage")} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">{t.storageAction}</button>
      </div>}
    </div>

    {dialog && createPortal(<div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onKeyDown={handleDialogKeyDown}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={dialog === "import" ? t.importBackup : dialog === "clear" ? t.clearData : t.localData} className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-[#161618] border border-[#2e2e32] p-5 text-sm text-[#f0ede8]">
        {dialog === "import" && <>
          <h2 className="mb-3 text-sm font-bold">{t.importBackup}</h2>
          <p className="text-xs text-[#b8b5af] mb-3">{t.importHelp}</p>
          <input ref={fileInput} aria-label={t.chooseBackupZip} type="file" accept=".zip,application/zip" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); void read(file); } event.target.value = ""; }} className="hidden" />
          <div className="flex flex-wrap items-center gap-3">
            <button autoFocus type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="shrink-0 rounded-lg border border-[#b8b5af] bg-[#303034] px-2.5 py-1.5 text-xs text-[#f0ede8] hover:bg-[#404046] disabled:opacity-50">{fileName ? t.changeFile : t.chooseBackupFile}</button>
            <span className="min-w-0 break-all text-xs text-[#b8b5af]">{fileName || t.noFileChosen}</span>
          </div>
          {preview && <p className="mt-4">{t.importPreview(pending!.collections.length, preview.added, preview.updated, preview.kept)}</p>}
          {flash && <p role="status" className="mt-4 text-xs text-[#e1c48e]">{flash}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button disabled={busy} onClick={closeDialog} className="text-xs text-[#b8b5af] p-2">{t.close}</button>
            {pending && <button disabled={busy} onClick={() => void submitImport()} className="text-xs bg-[#c9a96e] text-black rounded px-3 py-2 disabled:opacity-50">{busy ? t.processing : t.confirmImport}</button>}
          </div>
        </>}

        {dialog === "clear" && <>
          <h2 className="mb-3 text-sm font-bold">{t.clearData}</h2>
          <p className="text-xs text-[#b8b5af]">{t.clearDataHelp}</p>
          <div className="mt-5 flex justify-end gap-3">
            <button autoFocus type="button" disabled={busy} onClick={closeDialog} className="px-2 py-1 text-xs text-[#b8b5af] border border-[#2e2e32] rounded font-ui hover:text-[#f0ede8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a96e] disabled:opacity-50">{t.cancel}</button>
            <button type="button" disabled={busy} onClick={() => void submitClear()} className="px-2 py-1 text-xs bg-[#e06e6e] text-white rounded font-ui hover:bg-[#ef7f7f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e06e6e] disabled:opacity-50">{busy ? t.clearing : t.confirm}</button>
          </div>
        </>}

        {dialog === "storage" && <>
          <h2 className="mb-4 text-sm font-bold">{t.localData}</h2>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-3 text-xs">
            <dt className="text-[#b8b5af]">{t.storageUsed}</dt>
            <dd className="text-right font-technical tabular-nums">{storageStatus ? storageUsed ?? t.storageUnavailable : t.loadingStorage}</dd>
            <dt className="text-[#b8b5af]">{t.dataProtection}</dt>
            <dd className="text-right">{storageStatus ? storageStatus.persisted === true ? t.storageEnabled : storageStatus.persisted === false ? t.storageNotEnabled : t.storageUnavailable : t.loadingStorage}</dd>
          </dl>
          <div className="mt-5 flex justify-end">
            <button autoFocus type="button" onClick={closeDialog} className="text-xs text-[#b8b5af] p-2">{t.close}</button>
          </div>
        </>}
      </section>
    </div>, document.body)}
  </>;
}
