import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import type { Series, Comic } from '../lib/types';
import { getSeriesCoverUrl, getPlaceholderUrl, getThumbnailUrl } from '../lib/api';
import { Badge } from './ds';

/**
 * Reader side rail — series header + tabbed (Pages | Chapters) navigator.
 *
 * Used in two presentations:
 *   - Desktop: inline 304-wide rail, fixed `border-right`, no overlay.
 *   - Mobile (drawer=true): full-height fixed drawer, scrim backdrop, slide-in.
 *
 * Pages tab: 3-col grid of `2/3` page thumbnails (one per PDF page). Current
 * page = 2px accent border; pages already read (n < current) get a small
 * success ✓ at top-left and full opacity, unread are dimmed.
 *
 * Chapters tab: vertical list of every chapter in the series. Each row = a
 * 26×26 status chip (success ✓ box if read, else chapter number), name +
 * pages count, optional Reading / New Badge. Current chapter row is accent-tinted.
 */

interface ChapterRailProps {
  series: Series | null;
  comics: Comic[];
  currentComic: Comic;
  seriesId: string;
  currentPage: number;
  totalPages: number;
  /** Jump to page `n` (0-based) within the current chapter. */
  onJumpPage: (n: number) => void;
  /** Drawer-only: close button. */
  onClose?: () => void;
  /** Render as a fixed slide-in drawer instead of an inline rail. */
  drawer?: boolean;
}

export default function ChapterRail({
  series, comics, currentComic, seriesId,
  currentPage, totalPages,
  onJumpPage, onClose, drawer = false,
}: ChapterRailProps) {
  const [tab, setTab] = useState<'pages' | 'chapters'>('pages');

  const coverUrl = series?.coverFile
    ? getSeriesCoverUrl(seriesId, series.coverFile)
    : getPlaceholderUrl(series?.placeholder ?? 'manga.png');

  const body = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#121110',
        color: '#fff',
        borderRight: drawer ? 'none' : '1px solid rgb(255 255 255 / 0.08)',
      }}
    >
      {/* Series header */}
      <div
        style={{
          padding: '16px 16px 12px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          borderBottom: '1px solid rgb(255 255 255 / 0.08)',
        }}
      >
        <img
          src={coverUrl}
          alt=""
          style={{
            width: 44,
            height: 62,
            borderRadius: 4,
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {series?.name ?? 'Loading…'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {currentComic.order > 0 ? `Chapter ${currentComic.order}` : currentComic.file.replace(/\.pdf$/i, '')}
            {series?.englishTitle && series.englishTitle !== series.name && (
              <> · {series.englishTitle}</>
            )}
          </div>
        </div>
        {drawer && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={railIconBtn}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tab switch (pill toggle) */}
      <div style={{ display: 'flex', padding: '8px 12px 0', gap: 4 }}>
        {(['pages', 'chapters'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'capitalize',
              borderRadius: 7,
              cursor: 'pointer',
              border: 'none',
              background: tab === t ? 'rgb(255 255 255 / 0.12)' : 'transparent',
              color: tab === t ? '#fff' : 'rgb(255 255 255 / 0.55)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'pages' ? (
        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            alignContent: 'start',
          }}
        >
          {totalPages > 0 ? (
            Array.from({ length: totalPages }).map((_, i) => {
              const n = i; // 0-based
              const cur = n === currentPage;
              const past = n < currentPage;
              return (
                <button
                  key={n}
                  onClick={() => onJumpPage(n)}
                  style={{
                    position: 'relative',
                    padding: 0,
                    border: cur
                      ? '2px solid rgb(var(--accent))'
                      : '2px solid transparent',
                    borderRadius: 5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'rgb(255 255 255 / 0.05)',
                    aspectRatio: '2/3',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      opacity: past || cur ? 1 : 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'rgb(255 255 255 / 0.4)',
                    }}
                    className="bindery-nums"
                  >
                    {n + 1}
                  </div>
                  <span
                    className="bindery-nums"
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 3,
                      fontSize: 9,
                      color: '#fff',
                      background: 'rgb(0 0 0 / 0.6)',
                      padding: '0 4px',
                      borderRadius: 3,
                    }}
                  >
                    {n + 1}
                  </span>
                  {past && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: 3,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'rgb(var(--success))',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                fontSize: 12,
                color: 'rgb(255 255 255 / 0.5)',
                padding: '20px 0',
              }}
            >
              Loading pages…
            </div>
          )}
        </div>
      ) : (
        <div
          className="no-scrollbar"
          style={{ flex: 1, overflowY: 'auto', padding: 8 }}
        >
          {comics.map((c) => {
            const cur = c.file === currentComic.file;
            const inProg = c.currentPage > 0 && !c.isRead;
            const isNew = (c as { isNew?: boolean }).isNew === true;
            return (
              <Link
                key={c.file}
                to={`/read/${seriesId}/${c.file}`}
                replace
                onClick={(e) => {
                  if (cur) e.preventDefault();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  background: cur ? 'rgb(var(--accent) / 0.18)' : 'transparent',
                  color: '#fff',
                  marginBottom: 2,
                }}
              >
                <span
                  className="bindery-nums"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    background: c.isRead
                      ? 'rgb(var(--success) / 0.2)'
                      : 'rgb(255 255 255 / 0.08)',
                    color: c.isRead
                      ? 'rgb(var(--success))'
                      : 'rgb(255 255 255 / 0.6)',
                  }}
                >
                  {c.isRead ? <Check size={14} strokeWidth={2.5} /> : (c.order > 0 ? c.order : '·')}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: cur ? 600 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.order > 0 ? `Chapter ${c.order}` : c.file.replace(/\.pdf$/i, '')}
                  </span>
                  <span
                    className="bindery-nums"
                    style={{ display: 'block', fontSize: 11, opacity: 0.5 }}
                  >
                    {c.pages || '?'} pages
                  </span>
                </span>
                {inProg && (
                  <Badge intent="accent" pill>Reading</Badge>
                )}
                {isNew && !inProg && (
                  <Badge intent="new">New</Badge>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!drawer) return body;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgb(0 0 0 / 0.5)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          border: 'none',
          cursor: 'pointer',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 'min(320px, 84vw)',
          boxShadow: 'var(--shadow-2xl)',
          animation: 'reader-drawer-in 240ms cubic-bezier(0.22,0.61,0.36,1)',
        }}
      >
        {body}
      </div>
    </div>
  );
}

const railIconBtn = {
  background: 'rgb(255 255 255 / 0.08)',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  width: 30,
  height: 30,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
} as const;

// silence the unused import on the thumbnail fallback above
void getThumbnailUrl;
