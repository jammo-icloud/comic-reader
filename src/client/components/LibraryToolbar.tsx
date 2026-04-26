import { useEffect, useRef, useState } from 'react';
import { Search, X, Tag as TagIcon, ArrowUpDown, BookOpen, Newspaper, Check } from 'lucide-react';
import StickyToolbar from './StickyToolbar';
import ToolbarIconButton from './ToolbarIconButton';

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
  'count-desc': 'Most chs',
  'new-desc': 'New',
};

interface LibraryToolbarProps {
  /** Pixel offset for the sticky toolbar (so it pins below the page header). */
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
}

/**
 * Sticky toolbar for the library home — consolidates type filter, result count,
 * search, tag filter, and sort into one pinned row that mirrors the
 * SeriesPage chapter toolbar pattern.
 *
 * Behavior:
 *   - Type filter is a segmented control (was a hidden header dropdown)
 *   - Search opens an inline input row below the toolbar (same as SeriesPage chapters)
 *   - Tag chips live in a popover that opens from the [Tags] button
 *   - Sort lives in a popover from the [Sort] button
 *   - On mobile, button labels collapse to icons; tag/sort popovers anchor right
 */
export default function LibraryToolbar({
  topPx,
  typeFilter, onTypeChange,
  resultCount, totalCount, isFiltered,
  search, onSearchChange,
  allTags, activeTags, onToggleTag, onClearTags,
  sortBy, onSortChange,
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
    <StickyToolbar
      topPx={topPx}
      innerClassName="!max-w-7xl flex-col items-stretch !py-0 !gap-0"
    >
      {() => (
        <>
          {/* Main row */}
          <div className="flex items-center gap-2 py-2 px-4 sm:px-6">
            {/* Type segmented control */}
            <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 shrink-0">
              <SegmentButton
                active={typeFilter === 'comic'}
                onClick={() => onTypeChange('comic')}
                icon={<BookOpen size={13} />}
                label="Manga"
              />
              <SegmentButton
                active={typeFilter === 'magazine'}
                onClick={() => onTypeChange('magazine')}
                icon={<Newspaper size={13} />}
                label="Mags"
              />
            </div>

            {/* Title + count */}
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate min-w-0 ml-1">
              {search ? (
                <>
                  Matching <span className="font-normal text-gray-500 dark:text-gray-400 truncate">"{search}"</span>{' '}
                  <span className="text-gray-400 dark:text-gray-600 font-normal">({resultCount})</span>
                </>
              ) : isFiltered ? (
                <>{resultCount} <span className="text-gray-400 dark:text-gray-600 font-normal">of {totalCount}</span></>
              ) : (
                <>{totalCount}</>
              )}
            </div>

            <div className="flex-1" />

            {/* Search toggle */}
            <ToolbarIconButton
              onClick={() => {
                setShowSearch((v) => !v);
                if (showSearch) onSearchChange('');
              }}
              active={showSearch}
              title="Search"
            >
              <Search size={16} />
            </ToolbarIconButton>

            {/* Tags */}
            <div className="relative" ref={tagAnchorRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowTagMenu((v) => !v); setShowSortMenu(false); }}
                aria-pressed={showTagMenu || tagCount > 0}
                title="Filter by tags"
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[36px] rounded-md text-xs font-medium transition-colors shrink-0 ${
                  tagCount > 0
                    ? 'bg-accent/15 text-accent'
                    : showTagMenu
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <TagIcon size={14} />
                <span className="hidden sm:inline">Tags</span>
                {tagCount > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums">{tagCount}</span>
                )}
              </button>
              {showTagMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1 w-72 sm:w-80 max-h-[60vh] overflow-y-auto bg-surface dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 z-30"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                      Filter by tags
                    </span>
                    {tagCount > 0 && (
                      <button
                        onClick={() => onClearTags()}
                        className="text-[11px] text-accent hover:underline"
                      >
                        Clear ({tagCount})
                      </button>
                    )}
                  </div>
                  {allTags.length === 0 ? (
                    <p className="px-3 py-6 text-sm text-gray-400 dark:text-gray-500 text-center">No tags yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 p-3">
                      {allTags.map((tag) => {
                        const active = activeTags.has(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => onToggleTag(tag)}
                            className={`text-xs px-2.5 py-1 rounded-full capitalize transition-colors ${
                              active
                                ? 'bg-accent text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="relative" ref={sortAnchorRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowSortMenu((v) => !v); setShowTagMenu(false); }}
                aria-pressed={showSortMenu}
                title="Sort"
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[36px] rounded-md text-xs font-medium transition-colors shrink-0 ${
                  showSortMenu
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <ArrowUpDown size={14} />
                <span className="hidden sm:inline">{SORT_SHORT[sortBy]}</span>
              </button>
              {showSortMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1 min-w-[12rem] bg-surface dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden z-30"
                >
                  {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => {
                    const active = sortBy === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => { onSortChange(mode); setShowSortMenu(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                          active
                            ? 'bg-accent/10 text-accent font-medium'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span>{SORT_LABELS[mode]}</span>
                        {active && <Check size={14} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Search row — appears below the main row when toggled */}
          {showSearch && (
            <div className="px-4 sm:px-6 pb-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  autoFocus
                  placeholder={`Search ${typeFilter === 'comic' ? 'manga' : 'magazines'}…`}
                  className="w-full pl-8 pr-8 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent placeholder-gray-400 dark:placeholder-gray-500"
                />
                {search && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </StickyToolbar>
  );
}

// ----- Subcomponents -----

function SegmentButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors min-h-[28px] ${
        active
          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
