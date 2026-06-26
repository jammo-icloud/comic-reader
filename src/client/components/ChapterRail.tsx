import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import type { Series, Comic } from '../lib/types';
import { getSeriesCoverUrl, getPlaceholderUrl } from '../lib/api';
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
  /**
   * Render a single page thumbnail from the already-loaded PDF. Returns a
   * JPEG dataURL or null if rendering isn't possible yet. Calls are issued
   * lazily — only as cells scroll into view — so a long chapter doesn't
   * pin the main thread up front.
   */
  getPageThumbnail?: (pageIdx: number, maxWidth?: number) => Promise<string | null>;
  /** Drawer-only: close button. */
  onClose?: () => void;
  /** Render as a fixed slide-in drawer instead of an inline rail. */
  drawer?: boolean;
}

export default function ChapterRail({
  series, comics, currentComic, seriesId,
  currentPage, totalPages,
  onJumpPage, getPageThumbnail, onClose, drawer = false,
}: ChapterRailProps) {
  const [tab, setTab] = useState<'pages' | 'chapters'>('pages');

  // Page-thumbnail cache by 0-based page index. Lives at the rail level so
  // toggling between tabs doesn't discard thumbs already rendered, and a
  // serial fetch queue avoids hammering the PDF.js worker thread.
  const [thumbCache, setThumbCache] = useState<Map<number, string>>(() => new Map());
  const fetchingRef = useRef<Set<number>>(new Set());

  // Wipe the cache when the chapter changes — current PDF doc changes too.
  useEffect(() => {
    setThumbCache(new Map());
    fetchingRef.current = new Set();
  }, [currentComic.file]);

  const requestThumb = useCallback(
    (n: number) => {
      if (!getPageThumbnail) return;
      if (thumbCache.has(n)) return;
      if (fetchingRef.current.has(n)) return;
      fetchingRef.current.add(n);
      getPageThumbnail(n, 140)
        .then((dataUrl) => {
          fetchingRef.current.delete(n);
          if (!dataUrl) return;
          setThumbCache((prev) => {
            if (prev.has(n)) return prev;
            const next = new Map(prev);
            next.set(n, dataUrl);
            return next;
          });
        })
        .catch(() => { fetchingRef.current.delete(n); });
    },
    [getPageThumbnail, thumbCache],
  );

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
            Array.from({ length: totalPages }).map((_, i) => (
              <PageThumb
                key={i}
                pageIdx={i}
                isCurrent={i === currentPage}
                isPast={i < currentPage}
                thumb={thumbCache.get(i) ?? null}
                onVisible={requestThumb}
                onClick={() => onJumpPage(i)}
              />
            ))
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

/**
 * Single page-thumbnail cell. Uses an IntersectionObserver to defer the
 * actual PDF render until the cell scrolls into view — a 200-page chapter
 * doesn't queue 200 PDF.js render jobs up front, just the ~9 visible cells.
 * Cells already in `thumb` skip the observer entirely.
 */
function PageThumb({
  pageIdx, isCurrent, isPast, thumb, onVisible, onClick,
}: {
  pageIdx: number;
  isCurrent: boolean;
  isPast: boolean;
  thumb: string | null;
  onVisible: (pageIdx: number) => void;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thumb) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      onVisible(pageIdx);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onVisible(pageIdx);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '120px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pageIdx, thumb, onVisible]);

  // GRID ITEM is a plain <div ref> with `aspect-ratio: 2 / 3` — Chrome's
  // grid track sizing honors aspect-ratio on regular block-level elements
  // but apparently does NOT honor it on form-control children. When the
  // <button> was the grid item, row tracks computed to ~65px (the intrinsic
  // size of the button labels) and each 140-px button overflowed into the
  // next row — pages stacked. Wrapping the button in a div fixes track
  // sizing while keeping the button accessible/interactive.
  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '2 / 3',
      }}
    >
      <button
        onClick={onClick}
        style={{
          position: 'absolute',
          inset: 0,
          padding: 0,
          border: isCurrent
            ? '2px solid rgb(var(--accent))'
            : '2px solid transparent',
          borderRadius: 5,
          overflow: 'hidden',
          cursor: 'pointer',
          background: 'rgb(255 255 255 / 0.05)',
          opacity: isPast || isCurrent ? 1 : 0.6,
          display: 'block',
        }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            className="bindery-nums"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'rgb(255 255 255 / 0.4)',
            }}
          >
            {pageIdx + 1}
          </div>
        )}
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
          {pageIdx + 1}
        </span>
        {isPast && (
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
    </div>
  );
}
