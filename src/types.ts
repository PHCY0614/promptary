import type { PromptClassification } from "./promptClassification";

export type Status = "tried" | "want" | "ref";

// 常用平台選單；其他既有平台在編輯時保留為「自訂」，不刪除歷史紀錄。
export const PLATFORMS = [
  "PixAI",
  "Gemini",
  "ChatGPT",
  "自訂",
] as const;

export interface Attempt {
  id: string;
  name?: string;
  images: string[]; // base64 data URLs or https URLs
  platform: string;
  prompt: string; // may differ from originalPrompt
  promptClassification?: PromptClassification; // 閱讀分類獨立保存，不改 prompt
  model?: string;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export type CoverSource =
  | { type: "reference"; index: number }
  | { type: "attempt"; attemptId: string; imageIndex: number };

export interface Collection {
  id: string;
  name?: string;
  referenceImages: string[];
  coverSource: CoverSource;

  originalPrompt: string;
  promptPending: boolean;
  promptClassification?: PromptClassification;

  tags: string[];
  isFavorite: boolean;
  status: Status;

  collectionNotes: string;
  source?: string;

  attempts: Attempt[];

  addedAt: string; // ISO
  updatedAt: string; // ISO
}
