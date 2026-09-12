import { STATUS_STYLE } from "./statusStyles";
import { useState, useMemo, useRef, useEffect } from "react";
import { Collection, Status } from "./types";
import { getCoverImage, Store } from "./store";
import AboutDialog from "./AboutDialog";
import ImportBackup from "./ImportBackup";
import StoredImage from "./StoredImage";
import { LanguageSwitcher, brandSubtitleClass, useLocale } from "./i18n";

type SortKey = "newest" | "updated" | "oldest";

const STATUS_DOT: Record<Status, string> = {
  tried: "bg-[#91B8A0]",
  want: "bg-[#8FAFCB]",
  ref: "bg-[#B5A0D8]",
};

const ALL_TAGS_FROM = (cs: Collection[]) =>
  Array.from(new Set(cs.flatMap((c) => c.tags))).sort();

interface Props {
  store: Store;
  scrollPos: React.MutableRefObject<number>;
  onOpen: (id: string) => void;
  onAdd: () => void;
}

export default function Gallery({ store, scrollPos, onOpen, onAdd }: Props) {
  const { locale, t } = useLocale();
  const { collections, toggleFavorite } = store;
  const sortLabels: Record<SortKey, string> = { newest: t.sortNewest, updated: t.sortUpdated, oldest: t.sortOldest };

  const [filter, setFilter] = useState<Status | "all" | "favorite">("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const tagStripRef = useRef<HTMLDivElement>(null);
  const chooseTag = (tag: string) => {
    setActiveTags((current) => current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
    if (tagStripRef.current) tagStripRef.current.scrollLeft = 0;
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutButton = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // restore scroll on mount
  useEffect(() => {
    if (scrollPos.current && containerRef.current) {
      containerRef.current.scrollTop = scrollPos.current;
    }
  }, []);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) setSortMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [sortMenuOpen]);

  const allTags = useMemo(() => ALL_TAGS_FROM(collections), [collections]);

  const filtered = useMemo(() => {
    let list = [...collections];

    if (filter === "favorite") list = list.filter((c) => c.isFavorite);
    else if (filter !== "all") list = list.filter((c) => c.status === filter);

    // 多選標籤採 OR：符合任一已選標籤即可。
    if (activeTags.length) list = list.filter((c) => c.tags.some((tag) => activeTags.includes(tag)));

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.originalPrompt.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          c.collectionNotes.toLowerCase().includes(q) ||
          c.source?.toLowerCase().includes(q) ||
          c.attempts.some(
            (a) =>
              a.name?.toLowerCase().includes(q) ||
              a.prompt.toLowerCase().includes(q) ||
              a.notes.toLowerCase().includes(q) ||
              a.platform.toLowerCase().includes(q)
          )
      );
    }

    list.sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return list;
  }, [collections, filter, sort, search, activeTags]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto"
      onScroll={(e) => { scrollPos.current = (e.target as HTMLDivElement).scrollTop; }}
    >
      {/* Header：桌面左右等寬，中間搜尋固定置中；窄螢幕分列避免擠壓。 */}
      <header className="sticky top-0 z-30 bg-[#0d0d0e]/95 backdrop-blur-md border-b border-[#1e1e21]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)_minmax(0,1fr)] lg:items-center lg:gap-4">
          <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1
              className="text-xl font-semibold text-[#f0ede8] leading-tight"
              style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic" }}
            >
              Promptary
            </h1>
            <p className={`text-sm font-semibold italic text-[#9f9b95] whitespace-nowrap ${brandSubtitleClass(locale)}`}>{t.brandSubtitle} <span className="not-italic font-normal text-[#e8e1d7]">—☆ﾟ.*･</span></p>
          </div>

          {/* Search */}
          <div className="min-w-0 w-full max-w-sm justify-self-center lg:max-w-none">
            <div className="ios-form-zoom-fix relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b8b5af] text-xs select-none">⌕</span>
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#161618] border border-[#2e2e32] rounded-lg pl-9 pr-3 py-1.5 text-sm text-[#f0ede8] placeholder:text-[11px] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors font-ui"
              />
            </div>
          </div>

          <div className="min-w-0 flex flex-wrap items-center justify-end gap-2 lg:justify-self-end">
            <div className="flex items-center">
              <button
                ref={aboutButton}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={aboutOpen}
                onClick={() => setAboutOpen(true)}
                className="whitespace-nowrap px-2.5 py-1.5 text-xs font-ui font-normal text-[#b8b5af] hover:text-[#f0ede8] bg-transparent border border-transparent rounded-lg transition-colors"
              >
                {t.about}
              </button>
              <LanguageSwitcher />
            </div>
            <span aria-hidden="true" className="h-3.5 w-px shrink-0 self-center border-l border-[#2e2e32]" />
            <ImportBackup store={store} />
            {/* 排序與管理使用相同的箭頭、按鈕及等寬下拉選單。 */}
            <div ref={sortMenuRef} className="relative z-40 shrink-0" onKeyDown={(e) => { if (e.key === "Escape") { setSortMenuOpen(false); (e.currentTarget.querySelector("button") as HTMLButtonElement | null)?.focus(); } }}>
              <button type="button" aria-haspopup="true" aria-expanded={sortMenuOpen} onClick={() => setSortMenuOpen((current) => !current)} className="whitespace-nowrap bg-[#161618] px-2.5 py-1.5 text-xs text-[#b8b5af] border border-[#2e2e32] rounded-lg">
                {sortLabels[sort]}{" "}<span aria-hidden="true" className={`inline-block text-[14px] transition-transform duration-150 motion-reduce:transition-none ${sortMenuOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {sortMenuOpen && <div className="absolute right-0 top-full mt-1 w-full rounded-lg border border-[#2e2e32] bg-[#161618] p-1 shadow-xl">
                {(["newest", "updated", "oldest"] as const).map((value) => (
                  <button type="button" key={value} aria-pressed={sort === value} onClick={() => { setSort(value); setSortMenuOpen(false); }} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">{sortLabels[value]}</button>
                ))}
              </div>}
            </div>
            <button
              onClick={onAdd}
              className="px-3 py-1.5 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors"
            >
              {t.add}
            </button>
          </div>
        </div>

        {/* 狀態獨立成列，不隨標籤橫向捲動；窄螢幕允許換行。 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2.5 flex flex-wrap items-center gap-2">
          {(["all", "favorite", "tried", "want", "ref"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-7 flex-shrink-0 px-3 rounded-full border border-transparent text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                filter === f
                  ? (f === "all" || f === "favorite" ? "bg-[#c9a96e] text-[#0d0d0e]" : STATUS_STYLE[f])
                  : "text-[#b8b5af] hover:text-[#f0ede8]"
              }`}
            >
              {f === "all" ? t.statusAll : f === "favorite" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill={filter === "favorite" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>{t.statusFavorite}</> : t.statusLabel[f]}
            </button>
          ))}
        </div>
        {/* 標籤快篩單獨捲動，已選標籤排在最前面。 */}
        {allTags.length > 0 && <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2.5 flex items-center gap-2">
          <div ref={tagStripRef} className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {([...activeTags, ...allTags.filter((t) => !activeTags.includes(t))]).map((t) => (
            <button
              key={t}
              onClick={() => chooseTag(t)}
              className={`flex-shrink-0 text-[11px] font-technical px-2 py-0.5 rounded transition-colors ${
                activeTags.includes(t)
                  ? "bg-[#2a2010] text-[#c9a96e]"
                  : "text-[#b8b5af] hover:text-[#b8b5af]"
              }`}
            >
              #{t}
            </button>
          ))}
          </div>
          <button onClick={() => { setTagSearch(""); setShowTags(true); }} className="shrink-0 text-xs text-[#c9a96e] px-2 py-1">{t.allTags}</button>
          <button onClick={() => { setSearch(""); setFilter("all"); setActiveTags([]); setTagSearch(""); }} className="shrink-0 text-xs text-[#b8b5af] px-2 py-1">{t.reset}</button>
        </div>}
      </header>

      <AboutDialog
        open={aboutOpen}
        onClose={() => {
          setAboutOpen(false);
          requestAnimationFrame(() => aboutButton.current?.focus());
        }}
      />

      {/* 所有標籤：搜尋與限高清單，避免大量標籤撐長首頁。 */}
      {showTags && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowTags(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowTags(false); }}>
        <section role="dialog" aria-modal="true" aria-label={t.allTags} className="ios-form-zoom-fix w-full max-w-md rounded-xl bg-[#161618] border border-[#2e2e32] p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#f0ede8]">{t.allTags}</h2>
            <button onClick={() => setShowTags(false)} className="text-xs text-[#b8b5af] p-2">{t.close}</button>
          </div>
          <input autoFocus value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} aria-label={t.searchTags} placeholder={t.searchTagsPlaceholder} className="w-full rounded-lg bg-[#0d0d0e] border border-[#2e2e32] p-2 text-xs text-[#f0ede8] placeholder:text-[#9d9a94]" />
          <div className="mt-3 max-h-[50vh] overflow-y-auto flex flex-wrap gap-2">
            {allTags.filter((tag) => tag.toLowerCase().includes(tagSearch.trim().toLowerCase())).map((tag) => <button key={tag} aria-pressed={activeTags.includes(tag)} onClick={() => chooseTag(tag)} className={`max-w-full break-all rounded px-2 py-1 text-xs ${activeTags.includes(tag) ? "bg-[#2a2010] text-[#c9a96e]" : "bg-[#242427] text-[#c8c4bc]"}`}>#{tag}</button>)}
            {!allTags.some((tag) => tag.toLowerCase().includes(tagSearch.trim().toLowerCase())) && <p className="text-xs text-[#b8b5af]">{t.noMatchingTags}</p>}
          </div>
        </section>
      </div>}

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="text-[#b8b5af] font-ui text-sm">{t.noMatchingCollections}</p>
            {(search || filter !== "all" || activeTags.length > 0) && (
              <button
                onClick={() => { setSearch(""); setFilter("all"); setActiveTags([]); }}
                className="text-xs text-[#c9a96e] hover:underline font-ui"
              >
                {t.clearFilters}
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-[11px] text-[#b8b5af] font-ui mb-4">
              {t.collectionCount(filtered.length, collections.length)}
            </p>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
            >
              {filtered.map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  onOpen={() => onOpen(c.id)}
                  onToggleFavorite={() => toggleFavorite(c.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function CollectionCard({
  collection: c,
  onOpen,
  onToggleFavorite,
}: {
  collection: Collection;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const { t } = useLocale();
  const [imgLoaded, setImgLoaded] = useState(false);
  const cover = getCoverImage(c);
  const attemptCount = c.attempts.length;
  const bestRating = c.attempts.reduce((best, a) => Math.max(best, a.rating ?? 0), 0);

  return (
    <div className="group relative rounded-lg overflow-hidden bg-[#161618] border border-[#2e2e32] hover:border-[#c9a96e44] transition-all duration-200 cursor-pointer">
      {/* Image */}
      <div
        className="relative overflow-hidden bg-[#1e1e21]"
        style={{ aspectRatio: "3/4" }}
        onClick={onOpen}
      >
        {cover ? (
          <>
            <StoredImage
              image={cover}
              variant="thumbnail"
              adaptiveThumbnail
              alt=""
              className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.03] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
            />
            {!imgLoaded && <div className="absolute inset-0 bg-[#1e1e21] animate-pulse" />}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#b8b5af] text-3xl select-none">✦</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0e]/90 via-[#0d0d0e]/10 to-transparent" />

        {/* Pending badge */}
        {c.promptPending && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[11px] font-ui bg-[#2a1a00] text-[#c9a96e] border border-[#8a6e4244]">
            {t.promptPending}
          </div>
        )}

        {/* Attempt count */}
        {attemptCount > 0 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-ui bg-black/50 text-[#b8b5af]">
            {t.attemptCount(attemptCount)}
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          {c.name && (
            <p
              className="mb-1 text-xs font-normal text-[#f0ede8] line-clamp-1"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {c.name}
            </p>
          )}
          {!c.promptPending && c.originalPrompt && (
            <p
              className="text-[10px] text-[#b0aca5] leading-[1.5] line-clamp-2 mb-1.5 font-technical"
            >
              {c.originalPrompt}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_STYLE[c.status]}`}
            >
              <span className={`w-1 h-1 rounded-full ${STATUS_DOT[c.status]}`} />
              {t.statusLabel[c.status]}
            </span>
            {bestRating > 0 && (
              <span className="text-[#c9a96e] text-[11px] font-technical">{bestRating}★</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="px-2.5 py-2 flex items-center justify-between">
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {c.tags.slice(0, 2).map((t) => (
            <span key={t} className="text-[11px] text-[#b8b5af] font-technical truncate">
              #{t}
            </span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-label={c.isFavorite ? t.removeFavorite : t.addFavorite}
          aria-pressed={c.isFavorite}
          className={`inline-flex items-center justify-center transition-colors flex-shrink-0 ${c.isFavorite ? "text-[#DB8587]" : "text-[#b8b5af] hover:text-[#DB8587]"}`}
          title={c.isFavorite ? t.removeFavorite : t.addFavorite}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={c.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}


