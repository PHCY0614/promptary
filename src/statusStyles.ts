import type { Status } from "./types";

// 首頁、詳情與狀態選單共用配色，避免同一狀態呈現不同樣式。
export const STATUS_STYLE: Record<Status, string> = {
  ref: "text-status-ref bg-status-ref-bg border-status-ref",
  tried: "text-status-tried bg-status-tried-bg border-status-tried",
  want: "text-status-want bg-status-want-bg border-status-want",
};
