import { PLATFORMS } from "./types";

const PLATFORM_STORAGE_KEY = "promptary-custom-platforms";

export function normalizeCustomPlatforms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set(PLATFORMS.map((platform) => platform.toLocaleLowerCase()));
  const platforms: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const platform = candidate.trim();
    const key = platform.toLocaleLowerCase();
    if (!platform || seen.has(key)) continue;
    seen.add(key);
    platforms.push(platform);
  }
  return platforms;
}

export function readCustomPlatforms(): string[] {
  try {
    return normalizeCustomPlatforms(JSON.parse(localStorage.getItem(PLATFORM_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function writeCustomPlatforms(platforms: string[]): boolean {
  try {
    localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(normalizeCustomPlatforms(platforms)));
    return true;
  } catch {
    return false;
  }
}

export function clearCustomPlatforms(): boolean {
  try {
    localStorage.removeItem(PLATFORM_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
