import type { PromptClassification } from "./promptClassification";

export type Status = "tried" | "want" | "ref";

export interface ImageRef {
  id: string;
  width: number;
  height: number;
  mimeType: "image/webp" | "image/jpeg" | "image/png";
  byteSize: number;
  createdAt: string;
}

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
  images: ImageRef[];
  platform: string;
  promptMode: "original" | "custom";
  prompt: string; // may differ from originalPrompt
  promptClassification?: PromptClassification; // 閱讀分類獨立保存，不改 prompt
  model?: string;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export type CoverSource =
  | { type: "reference"; imageId: string }
  | { type: "attempt"; attemptId: string; imageId: string };

export interface Collection {
  id: string;
  name?: string;
  referenceImages: ImageRef[];
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
