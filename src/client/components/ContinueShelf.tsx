import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { ContinueReadingItem } from '../lib/types';
import { getSeriesCoverUrl, getPlaceholderUrl } from '../lib/api';
import ProgressBar from './ProgressBar';

/**
 * Continue Reading shelf — a horizontal scroll strip of compact "resume cards".
 *
 * Distinct from the main library grid:
 *   - Smaller (mini-cover left + text right, ~220px × 72px each)
 *   - Horizontal scroll with snap-x
 *   - Reads as a navigation aid, not browseable content
 *   - Heading is a kicker (text-xs uppercase) — not a peer to the library h2
 *   - Always visible (no collapse) when the user has in-progress chapters
 */
export default function ContinueShelf({ items }: { items: ContinueReadingItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Continue reading">
      <h2 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">
        Continue reading
        <span className="ml-1.5 text-gray-400 dark:text-gray-600 font-medium normal-case tracking-normal">
          · {items.length}
        </span>
      </h2>

      {/* Bleed the strip to the page edges on mobile so cards line up with content edge.
          snap-x keeps each card aligned to a stop when scrolling on touch. */}
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 snap-x snap-mandatory pb-1">
          {items.map((item) => {
            const pct = item.pages > 0 ? (item.currentPage / item.pages) * 100 : 0;
            const cover = item.coverFile
              ? getSeriesCoverUrl(item.seriesId, item.coverFile)
              : getPlaceholderUrl('manga.png');
            return (
              <Link
                key={`${item.seriesId}/${item.file}`}
                to={`/read/${item.seriesId}/${item.file}`}
                className="group snap-start shrink-0 w-[220px] flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-accent hover:shadow-md transition-all"
              >
                {/* Mini cover with play overlay */}
                <div className="relative w-10 h-14 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 ring-1 ring-black/5 dark:ring-white/5">
                  <img
                    src={cover}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholderUrl('manga.png'); }}
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                    <Play size={14} className="text-white" fill="currentColor" />
                  </div>
                </div>

                {/* Text + progress */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">{item.seriesName}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {item.file.replace(/\.pdf$/i, '')}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <ProgressBar value={pct} className="flex-1" />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
                      p.{item.currentPage + 1}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
