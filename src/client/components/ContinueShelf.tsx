import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { ContinueReadingItem } from '../lib/types';
import { getSeriesCoverUrl, getPlaceholderUrl } from '../lib/api';
import { Kicker, ProgressBar } from './ds';

/**
 * Continue Reading shelf — a horizontal scroll strip of compact "resume cards".
 *
 * Distinct from the main library grid:
 *   - Smaller (mini-cover left + text right, ~220px × 72px each)
 *   - Horizontal scroll with snap-x
 *   - Reads as a navigation aid, not browseable content
 *   - Heading is a Bindery Kicker (text-xs uppercase, accent count)
 *   - Always visible (no collapse) when the user has in-progress chapters
 */
export default function ContinueShelf({ items }: { items: ContinueReadingItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Continue reading">
      <Kicker count={items.length}>Continue reading</Kicker>

      {/* Bleed the strip to the page edges on mobile so cards line up with content edge.
          snap-x keeps each card aligned to a stop when scrolling on touch. */}
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto no-scrollbar mt-2">
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
                className="group snap-start shrink-0"
                style={{
                  width: 220,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 8,
                  borderRadius: 12,
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-default)',
                  textDecoration: 'none',
                }}
              >
                {/* Mini cover with play overlay */}
                <div
                  style={{
                    position: 'relative',
                    width: 40,
                    height: 56,
                    borderRadius: 6,
                    overflow: 'hidden',
                    background: 'var(--bg-subtle)',
                    flexShrink: 0,
                  }}
                >
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    className="truncate leading-tight"
                    style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)' }}
                  >
                    {item.seriesName}
                  </p>
                  <p
                    className="truncate"
                    style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}
                  >
                    {item.file.replace(/\.pdf$/i, '')}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <ProgressBar value={pct} className="flex-1" />
                    <span
                      className="bindery-nums shrink-0"
                      style={{ fontSize: 10, color: 'var(--text-muted)' }}
                    >
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
