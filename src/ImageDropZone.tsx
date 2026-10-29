import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useLocale } from "./i18n";

interface ImageDropZoneProps {
  disabled?: boolean;
  onFiles: (files: FileList) => void;
  children: ReactNode;
}

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** 讓區塊可接收拖曳進來的圖片檔案，交給原本的上傳流程處理。 */
export default function ImageDropZone({ disabled = false, onFiles, children }: ImageDropZoneProps) {
  const { t } = useLocale();
  const [isDragging, setIsDragging] = useState(false);
  // 拖曳經過子元素時會觸發多次 enter/leave，用計數判斷是否真正離開區塊
  const depth = useRef(0);

  function reset() {
    depth.current = 0;
    setIsDragging(false);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (disabled) return;
    depth.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled ? "none" : "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event) || disabled) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    reset();
    if (disabled) return;
    const files = event.dataTransfer.files;
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative -m-2 p-2 rounded-lg border border-dashed transition-colors ${isDragging ? "border-accent" : "border-transparent"}`}
    >
      {children}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-surface/80 backdrop-blur-[1px] flex items-center justify-center">
          <span className="text-xs font-ui text-accent-text">{t.imageDropRelease}</span>
        </div>
      )}
    </div>
  );
}
