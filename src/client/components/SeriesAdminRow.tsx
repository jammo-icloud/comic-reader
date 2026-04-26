import { Pencil, Trash2, Check, MoreVertical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface SeriesRow {
  id: string;
  name: string;
  englishTitle?: string | null;
  count: number;
  tags?: string[];
  malId?: number | null;
}

interface SeriesAdminRowProps {
  series: SeriesRow;
  /** When true, taps select for merge instead of opening edit. */
  selectMode?: boolean;
  /** Whether this row is currently in the merge selection. */
  selected?: boolean;
  /** Whether selection is allowed (e.g. cap of 2). */
  selectable?: boolean;
  onEdit: () => void;
  onPurge: () => void;
  onToggleSelect: () => void;
}

/**
 * Per-series row in the admin Library catalog.
 *   Mobile: stacked card with primary name, secondary stats, tertiary tags + ⋯
 *   Desktop (md+): the same DOM laid out as a grid row using
 *     `md:grid md:grid-cols-[1fr_auto_minmax(140px,200px)_64px_88px]`
 */
export default function SeriesAdminRow({
  series, selectMode, selected, selectable = true, onEdit, onPurge, onToggleSelect,
}: SeriesAdminRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    const t = setTimeout(() => window.addEventListener('click', handler), 0);
    return () => { clearTimeout(t); window.removeEventListener('click', handler); };
  }, [showMenu]);

  const tags = series.tags || [];
  const firstTag = tags[0];
  const extraTagCount = tags.length - 1;

  const handleRowClick = () => {
    if (selectMode) {
      if (selectable || selected) onToggleSelect();
    } else {
      onEdit();
    }
  };

  const stateClasses = selectMode
    ? selected
      ? 'bg-accent/10 dark:bg-accent/15 ring-2 ring-accent'
      : selectable
        ? 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 ring-1 ring-gray-200 dark:ring-gray-800'
        : 'bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 opacity-50'
    : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 ring-1 ring-gray-200 dark:ring-gray-800';

  const rowDisabled = selectMode && !selectable && !selected;

  return (
    <div
      className={`relative rounded-xl transition-all ${stateClasses}`}
    >
      {/* Row body uses role="button" instead of a real <button> so it can legally
          contain the desktop action <button>s without breaking HTML nesting rules. */}
      <div
        role="button"
        tabIndex={rowDisabled ? -1 : 0}
        aria-disabled={rowDisabled}
        onClick={() => { if (!rowDisabled) handleRowClick(); }}
        onKeyDown={(e) => {
          if (rowDisabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick();
          }
        }}
        className={`w-full text-left grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_minmax(140px,220px)_64px_88px] md:items-center gap-x-3 gap-y-1.5 px-4 py-3 md:py-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${rowDisabled ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {/* Selection check (only in select mode) */}
        {selectMode && (
          <span
            aria-hidden="true"
            className={`absolute left-2 top-2 md:relative md:left-auto md:top-auto md:order-first w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              selected
                ? 'bg-accent text-white'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            {selected && <Check size={12} strokeWidth={3} />}
          </span>
        )}

        {/* Name + english title */}
        <div className={`min-w-0 ${selectMode ? 'pl-8 md:pl-0' : ''}`}>
          <p className="text-sm font-medium truncate">{series.name}</p>
          {series.englishTitle && series.englishTitle.toLowerCase() !== series.name.toLowerCase() && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{series.englishTitle}</p>
          )}
          {/* Mobile-only secondary line: chapters · MAL · first tag (+N) */}
          <div className="md:hidden mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
            <span>{series.count} ch</span>
            {series.malId && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="font-mono">MAL #{series.malId}</span>
              </>
            )}
            {firstTag && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="capitalize px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px]">{firstTag}</span>
                {extraTagCount > 0 && (
                  <span className="text-[10px] text-gray-400">+{extraTagCount}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Trailing on mobile: ⋯ menu (out of grid order via col placement). On md+ this slot is empty. */}
        <span className="md:hidden col-start-2 row-start-1" />

        {/* === md:+ desktop columns === */}
        <span className="hidden md:inline text-sm text-gray-500 dark:text-gray-400 tabular-nums">{series.count}</span>

        <div className="hidden md:flex flex-wrap items-center gap-1 min-w-0">
          {tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full capitalize whitespace-nowrap">{t}</span>
          ))}
          {tags.length > 4 && (
            <span className="text-[10px] text-gray-400">+{tags.length - 4}</span>
          )}
        </div>

        <span className="hidden md:inline text-xs text-gray-500 dark:text-gray-400 font-mono">
          {series.malId ? `#${series.malId}` : '—'}
        </span>

        {/* Trailing actions on desktop — inline icons. On mobile the wrapper holds the ⋯ menu. */}
        <div className="hidden md:flex items-center justify-end gap-1 col-start-5">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 rounded-md hover:bg-accent/10 text-gray-400 hover:text-accent transition-colors"
            title="Edit series"
            aria-label="Edit series"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onPurge(); }}
            className="p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
            title="Purge (delete files)"
            aria-label="Purge series"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Mobile-only ⋯ menu — placed absolutely so it's not part of the row's tap target */}
      <div ref={menuRef} className="md:hidden absolute right-2 top-2">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
          className="p-2 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          title="Series actions"
          aria-label="Series actions"
        >
          <MoreVertical size={16} />
        </button>
        {showMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-10 min-w-[12rem] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden text-sm z-30"
          >
            <button
              onClick={() => { setShowMenu(false); onEdit(); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Pencil size={15} className="text-gray-500 dark:text-gray-400" />
              <span>Edit metadata</span>
            </button>
            <button
              onClick={() => { setShowMenu(false); onToggleSelect(); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Check size={15} className="text-gray-500 dark:text-gray-400" />
              <span>{selected ? 'Deselect' : 'Select for merge'}</span>
            </button>
            <div className="border-t border-gray-200 dark:border-gray-800" />
            <button
              onClick={() => { setShowMenu(false); onPurge(); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={15} />
              <span>Purge series</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
