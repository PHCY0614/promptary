import { STATUS_STYLE } from "./statusStyles";
import { useState, useMemo, useRef, useEffect } from "react";
import { Collection, Status } from "./types";
import { getCoverImage, Store } from "./store";
import ImportBackup from "./ImportBackup";

type SortKey = "newest" | "updated" | "oldest";

const STATUS_LABEL: Record<Status, string> = { tried: "已試過", want: "想試試", ref: "參考" };
const STATUS_DOT: Record<Status, string> = {
  tried: "bg-[#91B8A0]",
  want: "bg-[#D7B577]",
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
  const { collections, toggleFavorite } = store;

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
  const sortMenuRef = useRef<HTMLDetailsElement>(null);

  // restore scroll on mount
  useEffect(() => {
    if (scrollPos.current && containerRef.current) {
      containerRef.current.scrollTop = scrollPos.current;
    }
  }, []);

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
          c.originalPrompt.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          c.collectionNotes.toLowerCase().includes(q) ||
          c.source?.toLowerCase().includes(q) ||
          c.attempts.some(
            (a) =>
              a.prompt.toLowerCase().includes(q) ||
              a.notes.toLowerCase().includes(q) ||
              a.platform.toLowerCase().includes(q)
          )
      );
    }

    list.sort((a, b) => {
      if (sort === "newest") return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      if (sort === "oldest") return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
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
            <p className="text-sm italic text-[#9f9b95] whitespace-nowrap">你的咒語收藏庫 <span className="font-normal text-[#e8e1d7]">—☆ﾟ.*･</span></p>
          </div>

          {/* Search */}
          <div className="min-w-0 w-full max-w-sm justify-self-center lg:max-w-none">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b8b5af] text-xs select-none">⌕</span>
              <input
                type="text"
                placeholder="搜尋 prompt、筆記、標籤…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#161618] border border-[#2e2e32] rounded-lg pl-9 pr-3 py-1.5 text-sm text-[#f0ede8] placeholder:text-[11px] placeholder-[#9d9a94] focus:outline-none focus:border-[#c9a96e55] transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>

          <div className="min-w-0 flex flex-wrap items-center justify-end gap-2 lg:justify-self-end">
            <ImportBackup store={store} />
            {/* 排序與管理使用相同的箭頭、按鈕及等寬下拉選單。 */}
            <details ref={sortMenuRef} className="relative shrink-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.open = false; }} onKeyDown={(e) => { if (e.key === "Escape" && sortMenuRef.current) sortMenuRef.current.open = false; }}>
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden whitespace-nowrap bg-[#161618] px-2.5 py-1.5 text-xs text-[#b8b5af] border border-[#2e2e32] rounded-lg">{{ newest: "最新收藏", updated: "最近更新", oldest: "最早收藏" }[sort]} ▾</summary>
              <div className="absolute right-0 top-full mt-2 w-full rounded-lg border border-[#2e2e32] bg-[#161618] p-1 shadow-xl">
                {([["newest", "最新收藏"], ["updated", "最近更新"], ["oldest", "最早收藏"]] as const).map(([value, label]) => (
                  <button key={value} aria-pressed={sort === value} onClick={() => { setSort(value); if (sortMenuRef.current) sortMenuRef.current.open = false; }} className="w-full whitespace-nowrap text-left px-1.5 py-2 text-xs text-[#f0ede8] hover:bg-[#2e2e32] rounded">{label}</button>
                ))}
              </div>
            </details>
            <button
              onClick={onAdd}
              className="px-3 py-1.5 text-xs font-medium bg-[#c9a96e] text-[#0d0d0e] rounded-lg hover:bg-[#d4b87e] transition-colors"
            >
              + 新增
            </button>
          </div>
        </div>

        {/* 狀態獨立成列，不隨標籤橫向捲動；窄螢幕允許換行。 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2.5 flex flex-wrap items-center gap-2">
          {(["all", "favorite", "tried", "want", "ref"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? (f === "all" || f === "favorite" ? "bg-[#c9a96e] text-[#0d0d0e]" : `border ${STATUS_STYLE[f]}`)
                  : "text-[#b8b5af] hover:text-[#f0ede8]"
              }`}
            >
              {f === "all" ? "全部" : f === "favorite" ? "♥ 最愛" : STATUS_LABEL[f]}
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
              className={`flex-shrink-0 text-[11px] font-mono px-2 py-0.5 rounded transition-colors ${
                activeTags.includes(t)
                  ? "bg-[#2a2010] text-[#c9a96e]"
                  : "text-[#b8b5af] hover:text-[#b8b5af]"
              }`}
            >
              #{t}
            </button>
          ))}
          </div>
          <button onClick={() => { setTagSearch(""); setShowTags(true); }} className="shrink-0 text-xs text-[#c9a96e] px-2 py-1">所有標籤</button>
          <button onClick={() => { setSearch(""); setFilter("all"); setActiveTags([]); setTagSearch(""); }} className="shrink-0 text-xs text-[#b8b5af] px-2 py-1">重設</button>
        </div>}
      </header>

      {/* 所有標籤：搜尋與限高清單，避免大量標籤撐長首頁。 */}
      {showTags && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowTags(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowTags(false); }}>
        <section role="dialog" aria-modal="true" aria-label="所有標籤" className="w-full max-w-md rounded-xl bg-[#161618] border border-[#2e2e32] p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#f0ede8]">所有標籤</h2>
            <button onClick={() => setShowTags(false)} className="text-xs text-[#b8b5af] p-2">關閉</button>
          </div>
          <input autoFocus value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} aria-label="搜尋標籤" placeholder="搜尋標籤…" className="w-full rounded-lg bg-[#0d0d0e] border border-[#2e2e32] p-2 text-xs text-[#f0ede8] placeholder:text-[#9d9a94]" />
          <div className="mt-3 max-h-[50vh] overflow-y-auto flex flex-wrap gap-2">
            {allTags.filter((t) => t.toLowerCase().includes(tagSearch.trim().toLowerCase())).map((t) => <button key={t} aria-pressed={activeTags.includes(t)} onClick={() => chooseTag(t)} className={`max-w-full break-all rounded px-2 py-1 text-xs ${activeTags.includes(t) ? "bg-[#2a2010] text-[#c9a96e]" : "bg-[#242427] text-[#c8c4bc]"}`}>#{t}</button>)}
            {!allTags.some((t) => t.toLowerCase().includes(tagSearch.trim().toLowerCase())) && <p className="text-xs text-[#b8b5af]">沒有符合的標籤</p>}
          </div>
        </section>
      </div>}

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="text-[#b8b5af] font-mono text-sm">沒有符合的收藏</p>
            {(search || filter !== "all" || activeTags.length > 0) && (
              <button
                onClick={() => { setSearch(""); setFilter("all"); setActiveTags([]); }}
                className="text-xs text-[#c9a96e] hover:underline font-mono"
              >
                清除篩選
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-[11px] text-[#b8b5af] font-mono mb-4">
              {filtered.length} / {collections.length} 張收藏
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
            <img
              src={cover}
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
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[11px] font-mono bg-[#2a1a00] text-[#c9a96e] border border-[#8a6e4244]">
            待補 prompt
          </div>
        )}

        {/* Attempt count */}
        {attemptCount > 0 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-mono bg-black/50 text-[#b8b5af]">
            {attemptCount} 次嘗試
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          {!c.promptPending && c.originalPrompt && (
            <p
              className="text-[11px] text-[#b0aca5] leading-relaxed line-clamp-2 mb-1.5"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {c.originalPrompt}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_STYLE[c.status]}`}
            >
              <span className={`w-1 h-1 rounded-full ${STATUS_DOT[c.status]}`} />
              {STATUS_LABEL[c.status]}
            </span>
            {bestRating > 0 && (
              <span className="text-[#c9a96e] text-[11px] font-mono">{bestRating}★</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="px-2.5 py-2 flex items-center justify-between">
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {c.tags.slice(0, 2).map((t) => (
            <span key={t} className="text-[11px] text-[#b8b5af] font-mono truncate">
              #{t}
            </span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={`text-sm transition-colors flex-shrink-0 ${c.isFavorite ? "text-[#e06e6e]" : "text-[#b8b5af] hover:text-[#b8b5af]"}`}
          title={c.isFavorite ? "取消最愛" : "加入最愛"}
        >
          ♥
        </button>
      </div>
    </div>
  );
}


