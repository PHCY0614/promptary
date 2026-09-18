import type { Collection } from "./types"

export interface TagSummary {
  key: string
  label: string
  count: number
  lastUsedAt: number
}

export function cleanTag(value: string) {
  return value.trim().replace(/^#+/, "").trim().normalize("NFC")
}

export function normalizeTag(value: string) {
  return cleanTag(value).toLowerCase()
}

export function uniqueTags(values: readonly string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const label = cleanTag(value)
    const key = normalizeTag(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(label)
  }

  return result
}

function timestampOf(collection: Collection) {
  const timestamp = Date.parse(collection.updatedAt || collection.createdAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function summarizeTags(
  collections: readonly Collection[],
  locale?: string,
) {
  const aggregate = new Map<string, {
    count: number
    lastUsedAt: number
    variants: Map<string, { count: number; lastUsedAt: number }>
  }>()

  for (const collection of collections) {
    const usedAt = timestampOf(collection)
    const labelsInCollection = new Map<string, string>()
    for (const rawTag of collection.tags) {
      const label = cleanTag(rawTag)
      const key = normalizeTag(label)
      if (key && !labelsInCollection.has(key))
        labelsInCollection.set(key, label)
    }

    for (const [key, label] of labelsInCollection) {
      const current = aggregate.get(key) ?? {
        count: 0,
        lastUsedAt: 0,
        variants: new Map(),
      }
      current.count += 1
      current.lastUsedAt = Math.max(current.lastUsedAt, usedAt)
      const variant = current.variants.get(label) ?? { count: 0, lastUsedAt: 0 }
      variant.count += 1
      variant.lastUsedAt = Math.max(variant.lastUsedAt, usedAt)
      current.variants.set(label, variant)
      aggregate.set(key, current)
    }
  }

  const collator = new Intl.Collator(locale, {
    sensitivity: "base",
    numeric: true,
  })
  const summaries: TagSummary[] = []
  for (const [key, value] of aggregate) {
    const label = [...value.variants.entries()].sort(
      (a, b) =>
        b[1].count - a[1].count ||
        b[1].lastUsedAt - a[1].lastUsedAt ||
        collator.compare(a[0], b[0]),
    )[0]?.[0]
    if (label)
      summaries.push({
        key,
        label,
        count: value.count,
        lastUsedAt: value.lastUsedAt,
      })
  }

  return summaries.sort(
    (a, b) =>
      b.count - a.count ||
      b.lastUsedAt - a.lastUsedAt ||
      collator.compare(a.label, b.label),
  )
}

export function collectionHasAnyTag(
  tags: readonly string[],
  activeKeys: ReadonlySet<string>,
) {
  return tags.some((tag) => activeKeys.has(normalizeTag(tag)))
}
