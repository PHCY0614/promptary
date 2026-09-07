import type { Status } from "./types";

// 首頁、詳情與狀態選單共用配色，避免同一狀態呈現不同樣式。
export const STATUS_STYLE: Record<Status, string> = {
  ref: "text-[#B5A0D8] bg-[#282231] border-[#B5A0D8]",
  tried: "text-[#91B8A0] bg-[#202D26] border-[#91B8A0]",
  want: "text-[#D7B577] bg-[#30291D] border-[#D7B577]",
};
