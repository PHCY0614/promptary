import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useLocale } from "./i18n"
import { cleanTag, normalizeTag, type TagSummary, uniqueTags } from "./tags"

interface Props {
  selected: string[]
  draft: string
  suggestions: readonly TagSummary[]
  onSelectedChange: (tags: string[]) => void
  onDraftChange: (draft: string) => void
}

export default function TagPicker({
  selected,
  draft,
  suggestions,
  onSelectedChange,
  onDraftChange,
}: Props) {
  const { t } = useLocale()
  const inputId = useId()
  const hintId = useId()
  const suggestionsId = useId()
  const composingRef = useRef(false)
  const commonRowRef = useRef<HTMLDivElement>(null)
  const [showAll, setShowAll] = useState(false)
  const [commonVisibleCount, setCommonVisibleCount] = useState(0)
  const selectedKeys = useMemo(
    () => new Set(selected.map(normalizeTag)),
    [selected],
  )
  const queryKey = normalizeTag(draft)
  const available = suggestions.filter((tag) => !selectedKeys.has(tag.key))
  const matching = queryKey
    ? available.filter((tag) => tag.key.includes(queryKey))
    : []
  const visibleSuggestions = queryKey ? matching : available
  const availableTagKey = available
    .map((tag) => `${tag.key}:${tag.label}`)
    .join("\u0000")
  const exactSuggestion = queryKey
    ? suggestions.find((tag) => tag.key === queryKey)
    : undefined

  useLayoutEffect(() => {
    if (queryKey || showAll) return
    const currentRow = commonRowRef.current
    if (!currentRow) return
    let active = true

    function updateVisibleCount() {
      const row = commonRowRef.current
      if (!active || !row) return
      const items = Array.from(
        row.querySelectorAll<HTMLElement>("[data-common-tag]"),
      )
      const firstTop = items[0]?.offsetTop
      const count =
        firstTop === undefined
          ? 0
          : items.filter((item) => item.offsetTop === firstTop).length
      setCommonVisibleCount(count)
    }

    updateVisibleCount()
    const observer = new ResizeObserver(updateVisibleCount)
    observer.observe(currentRow)
    document.fonts?.ready.then(updateVisibleCount)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [availableTagKey, queryKey, showAll])

  function appendTags(current: readonly string[], values: readonly string[]) {
    let next = [...current]
    for (const value of values) {
      const cleaned = cleanTag(value)
      if (!cleaned) continue
      const key = normalizeTag(cleaned)
      const canonical =
        suggestions.find((tag) => tag.key === key)?.label ?? cleaned
      next = uniqueTags([...next, canonical])
    }
    return next
  }

  function commit(values: readonly string[], clearDraft = true) {
    onSelectedChange(appendTags(selected, values))
    if (clearDraft) onDraftChange("")
  }

  function handleInputValue(value: string) {
    if (composingRef.current || !/[,，]/.test(value)) {
      onDraftChange(value)
      return
    }
    const parts = value.split(/[,，]/)
    onSelectedChange(appendTags(selected, parts.slice(0, -1)))
    onDraftChange(parts.at(-1) ?? "")
  }

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape" && (draft || showAll)) {
          event.stopPropagation()
          onDraftChange("")
          setShowAll(false)
        }
      }}
    >
      <label
        htmlFor={inputId}
        className="text-xs text-[#b8b5af] font-ui normal-case tracking-normal block mb-1.5"
      >
        {t.tagsComma}
      </label>

      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label={t.selectedTags}>
          {selected.map((tag) => {
            const key = normalizeTag(tag)
            const label =
              suggestions.find((summary) => summary.key === key)?.label ??
              cleanTag(tag)
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onSelectedChange(
                    selected.filter((value) => normalizeTag(value) !== key),
                  )
                }
                aria-label={t.removeTag(label)}
                title={label}
                className="inline-flex min-h-7 max-w-full items-center gap-1 overflow-hidden rounded-md border border-[#6f5b35] bg-[#2a2010] px-2 py-1 text-[11px] text-[#d8bd83] transition-colors hover:border-[#c9a96e] hover:text-[#f0d9a6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a96e]"
              >
                <span className="min-w-0 truncate whitespace-nowrap font-technical">#{label}</span>
                <span aria-hidden="true" className="shrink-0 text-sm leading-none">
                  ×
                </span>
              </button>
            )
          })}
        </div>
      )}

      <input
        id={inputId}
        type="text"
        value={draft}
        onChange={(event) => handleInputValue(event.target.value)}
        onCompositionStart={() => {
          composingRef.current = true
        }}
        onCompositionEnd={(event) => {
          composingRef.current = false
          handleInputValue(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" ||
            event.nativeEvent.isComposing ||
            composingRef.current
          )
            return
          event.preventDefault()
          if (cleanTag(draft)) commit([draft])
        }}
        placeholder={t.tagsPlaceholder}
        aria-describedby={hintId}
        className="w-full bg-[#0d0d0e] border border-[#2e2e32] rounded-lg px-3 py-2 text-xs text-[#c8c4bc] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors font-technical"
      />
      <p
        id={hintId}
        className="mt-1.5 text-[11px] leading-relaxed text-[#9d9a94]"
      >
        {t.tagsHint}
      </p>

      {(available.length > 0 || (queryKey && !exactSuggestion)) && (
        <div className="mt-2 flex min-w-0 items-start gap-1.5">
          <div
            id={suggestionsId}
            ref={commonRowRef}
            className={`${
              queryKey || showAll
                ? "flex max-h-48 min-w-0 flex-1 flex-wrap gap-1.5 overflow-y-auto pr-1"
                : "flex max-h-7 min-w-0 flex-1 flex-wrap gap-1.5 overflow-hidden"
            }`}
          >
            {visibleSuggestions.map((tag, index) => (
              <button
                key={tag.key}
                type="button"
                onClick={() => commit([tag.label])}
                title={tag.label}
                data-common-tag={!queryKey && !showAll ? "" : undefined}
                aria-hidden={
                  !queryKey && !showAll && index >= commonVisibleCount
                    ? true
                    : undefined
                }
                tabIndex={
                  !queryKey && !showAll && index >= commonVisibleCount
                    ? -1
                    : undefined
                }
                className="inline-flex min-h-7 min-w-0 max-w-full shrink-0 overflow-hidden rounded-md border border-[#2e2e32] bg-[#242427] px-2 py-1 text-[11px] text-[#c8c4bc] transition-colors hover:border-[#c9a96e55] hover:text-[#f0ede8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a96e]"
              >
                <span className="block min-w-0 truncate whitespace-nowrap">#{tag.label}</span>
              </button>
            ))}
            {queryKey && !exactSuggestion && (
              <button
                type="button"
                onClick={() => commit([draft])}
                title={t.createTag(cleanTag(draft))}
                className="min-h-7 max-w-full shrink-0 truncate whitespace-nowrap rounded-md border border-dashed border-[#6f5b35] px-2 py-1 text-left text-[11px] text-[#c9a96e] transition-colors hover:border-[#c9a96e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a96e]"
              >
                {t.createTag(cleanTag(draft))}
              </button>
            )}
            {queryKey &&
              visibleSuggestions.length === 0 &&
              exactSuggestion &&
              selectedKeys.has(exactSuggestion.key) && (
                <p className="py-2 text-xs text-[#9d9a94]">
                  {t.tagAlreadySelected}
                </p>
              )}
          </div>
          {!queryKey &&
            commonVisibleCount > 0 &&
            commonVisibleCount < available.length && (
              <button
                type="button"
                aria-label={showAll ? t.fewerTags : t.moreTags}
                aria-controls={suggestionsId}
                aria-expanded={showAll}
                onClick={() => setShowAll((current) => !current)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#c9a96e] transition-colors hover:text-[#f0d9a6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a96e]"
              >
                <span
                  aria-hidden="true"
                  className={`inline-block text-base leading-none transition-transform duration-150 motion-reduce:transition-none ${showAll ? "rotate-180" : ""}`}
                >
                  ▾
                </span>
              </button>
            )}
        </div>
      )}
    </div>
  )
}
