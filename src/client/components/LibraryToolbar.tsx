import { useEffect, useRef, useState } from 'react';
import {
  Search, X, Tag as TagIcon, ArrowUpDown, BookOpen, Newspaper,
  Check, BookOpenCheck, Pin, Download,
} from 'lucide-react';
import { SegmentedControl, IconButton } from './ds';

export type SortMode = 'name-asc' | 'name-desc' | 'score-desc' | 'year-desc' | 'count-desc' | 'new-desc';

const SORT_LABELS: Record<SortMode, string> = {
  'name-asc': 'Title A → Z',
  'name-desc': 'Title Z → A',
  'score-desc': 'Highest score',
  'year-desc': 'Newest',
  'count-desc': 'Most chapters',
  'new-desc': 'New chapters first',
};

const SORT_SHORT: Record<SortMode, string> = {
  'name-asc': 'A → Z',
  'name-desc': 'Z → A',
  'score-desc': 'Score',
  'year-desc': 'Newest',
  'count-desc': 'Most',
  'new-desc': 'New',
};

interface LibraryToolbarProps {
  /** Pixel offset for the sticky toolbar (so it pins below the global Bindery header). */
  topPx: number;

  // Type filter (segmented control)
  typeFilter: 'comic' | 'magazine';
  onTypeChange: (t: 'comic' | 'magazine') => void;

  // Result count + descriptor
  resultCount: number;
  totalCount: number;
  isFiltered: boolean;

  // Search
  search: string;
  onSearchChange: (v: string) => void;

  // Tags
  allTags: string[];
  activeTags: Set<string>;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;

  // Sort
  sortBy: SortMode;
  onSortChange: (mode: SortMode) => void;

  // Hide caught-up: only series with unread chapters or new subscription chapters.
  hideCaughtUp: boolean;
  onHideCaughtUpChange: (v: boolean) => void;

  // Pinned only: the user's hand-curated "currently reading" set.
  pinnedOnly: boolean;
  onPinnedOnlyChange: (v: boolean) => void;

  // Offline only: series explicitly saved for offline reading.
  offlineOnly: boolean;
  onOfflineOnlyChange: (v: boolean) => void;
  offlineCount: number;
}

/**
 * Bindery sub-nav for the library home — slim glass row pinned just below the
 * global Bindery header. Mirrors the prototype's chrome:
 *   [Manga|Mags]  N series  ················  [search input]  🔍 📌 ⬇ 📖 🏷 ↕
 *
 * The Pinned / Offline / Hide-read toggles read as slim DS IconButtons (no
 * heavy chip backgrounds); Tags + Sort open right-anchored `var(--surface-raised)`
 * popovers. Offline button only appears once at least one series is saved.
 */
export default function LibraryToolbar({
  topPx,
  typeFilter, onTypeChange,
  resultCount, totalCount, isFiltered,
  search, onSearchChange,
  allTags, activeTags, onToggleTag, onClearTags,
  sortBy, onSortChange,
  hideCaughtUp, onHideCaughtUpChange,
  pinnedOnly, onPinnedOnlyChange,
  offlineOnly, onOfflineOnlyChange, offlineCount,
}: LibraryToolbarProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const tagAnchorRef = useRef<HTMLDivElement>(null);
  const sortAnchorRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click. setTimeout so the click that opened the
  // menu doesn't immediately close it.
  useEffect(() => {
    if (!showTagMenu && !showSortMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showTagMenu && tagAnchorRef.current && !tagAnchorRef.current.contains(target)) {
        setShowTagMenu(false);
      }
      if (showSortMenu && sortAnchorRef.current && !sortAnchorRef.current.contains(target)) {
        setShowSortMenu(false);
      }
    };
    const t = setTimeout(() => window.addEventListener('click', handler), 0);
    return () => { clearTimeout(t); window.removeEventListener('click', handler); };
  }, [showTagMenu, showSortMenu]);

  // Esc closes whichever popover is open
  useEffect(() => {
    if (!showTagMenu && !showSortMenu && !showSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showTagMenu) setShowTagMenu(false);
      if (showSortMenu) setShowSortMenu(false);
      if (showSearch && !search) setShowSearch(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTagMenu, showSortMenu, showSearch, search]);

  const tagCount = activeTags.size;

  return (
    <div
      style={{
        position: 'sticky',
        top: topPx,
        zIndex: 20,
        background: 'var(--chrome-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Type filter — DS SegmentedControl */}
        <SegmentedControl
          options={[
            { value: 'comic', label: 'Manga', icon: <BookOpen size={13} /> },
            { value: 'magazine', label: 'Mags', icon: <Newspaper size={13} /> },
          ]}
          value={typeFilter}
          onChange={onTypeChange}
        />

        {/* Count — Bindery monospace nums */}
        <span
          className="bindery-nums"
          style={{ fontSize: 13, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}
        >
          {search
            ? <>Matching "{search}" ({resultCount})</>
            : isFiltered
              ? <>{resultCount} of {totalCount}</>
              : <>{totalCount} series</>}
        </span>

        <div style={{ flex: 1 }} />

        {/* Inline search input — by-input, appears next to the Search toggle */}
        {showSearch && (
          <input
            autoFocus
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${typeFilter === 'comic' ? 'manga' : 'magazines'}…`}
            className="by-input"
            style={{ width: 200, height: 36 }}
          />
        )}

        {/* Search toggle */}
        <IconButton
          title={showSearch ? 'Close search' : 'Search'}
          active={showSearch}
          onClick={() => {
            setShowSearch((v) => !v);
            if (showSearch) onSearchChange('');
          }}
        >
          {showSearch ? <X size={16} /> : <Search size={16} />}
        </IconButton>

        {/* Pinned only */}
        <IconButton
          title={pinnedOnly ? 'Showing only pinned' : 'Show only pinned series'}
          active={pinnedOnly}
          onClick={() => onPinnedOnlyChange(!pinnedOnly)}
        >
          <Pin
            size={16}
            fill={pinnedOnly ? 'currentColor' : 'none'}
            strokeWidth={pinnedOnly ? 0 : 2}
          />
        </IconButton>

        {/* Offline only — hidden until at least one series is saved offline.
            Preserves the visual treatment introduced in 32b3027. */}
        {offlineCount > 0 && (
          <IconButton
            title={offlineOnly ? 'Showing only offline' : 'Show only offline series'}
            active={offlineOnly}
            onClick={() => onOfflineOnlyChange(!offlineOnly)}
          >
            <Download size={16} />
          </IconButton>
        )}

        {/* Hide caught up */}
        <IconButton
          title={hideCaughtUp ? 'Showing unread only' : 'Hide series you’re caught up on'}
          active={hideCaughtUp}
          onClick={() => onHideCaughtUpChange(!hideCaughtUp)}
        >
          <BookOpenCheck size={16} />
        </IconButton>

        {/* Tags — popover with active-count label */}
        <div ref={tagAnchorRef} style={{ position: 'relative' }}>
          <IconButton
            title="Filter by tags"
            active={tagCount > 0 || showTagMenu}
            label={tagCount > 0 ? String(tagCount) : undefined}
            onClick={(e) => {
              e.stopPropagation();
              setShowTagMenu((v) => !v);
              setShowSortMenu(false);
            }}
          >
            <TagIcon size={16} />
          </IconButton>
          {showTagMenu && (
            <Popover>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span className="by-kicker">Filter by tags</span>
                {tagCount > 0 && (
                  <button
                    onClick={() => onClearTags()}
                    style={{
                      fontSize: 11,
                      color: 'var(--color-accent)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Clear ({tagCount})
                  </button>
                )}
              </div>
              {allTags.length === 0 ? (
                <p
                  style={{
                    padding: '24px 14px',
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  No tags yet.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    padding: 12,
                    maxHeight: '60vh',
                    overflowY: 'auto',
                  }}
                >
                  {allTags.map((tag) => {
                    const active = activeTags.has(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => onToggleTag(tag)}
                        className={active ? '' : 'by-tag'}
                        style={
                          active
                            ? {
                                fontSize: 12,
                                padding: '3px 10px',
                                borderRadius: 9999,
                                background: 'var(--color-accent)',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                              }
                            : {
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                              }
                        }
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </Popover>
          )}
        </div>

        {/* Sort — popover with current-mode label */}
        <div ref={sortAnchorRef} style={{ position: 'relative' }}>
          <IconButton
            title="Sort"
            active={showSortMenu}
            label={SORT_SHORT[sortBy]}
            onClick={(e) => {
              e.stopPropagation();
              setShowSortMenu((v) => !v);
              setShowTagMenu(false);
            }}
          >
            <ArrowUpDown size={16} />
          </IconButton>
          {showSortMenu && (
            <Popover>
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => {
                const active = sortBy === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => { onSortChange(mode); setShowSortMenu(false); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 14px',
                      fontSize: 13,
                      background: active ? 'rgb(var(--accent) / 0.1)' : 'none',
                      color: active ? 'var(--color-accent)' : 'var(--text-body)',
                      fontWeight: active ? 500 : 400,
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'none';
                    }}
                  >
                    <span>{SORT_LABELS[mode]}</span>
                    {active && <Check size={14} />}
                  </button>
                );
              })}
            </Popover>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Right-anchored `var(--surface-raised)` popover shared by the Tags + Sort
 * dropdowns. Sits just below its anchor IconButton.
 */
function Popover({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 4px)',
        minWidth: 240,
        maxWidth: 320,
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-2xl)',
        overflow: 'hidden',
        zIndex: 30,
      }}
    >
      {children}
    </div>
  );
}
