import { Link } from 'react-router-dom';
import { Check, ChevronRight, AlertTriangle, Download } from 'lucide-react';
import type { Comic } from '../lib/types';
import { updateProgress } from '../lib/api';
import { Badge, ProgressBar } from './ds';

/**
 * Bindery chapter row — `by-card by-card--interactive` surface, colored
 * number box on the left, title + meta + (in-progress) progress bar in
 * the middle, state Badge on the right, chevron-right at the end.
 *
 * Matches the prototype's ChapterList row 1:1, with the production extras
 * preserved: a click handler on the number box toggles read state, and a
 * Partial chapter shows the warning Badge with the ok/total fraction.
 */
export default function ComicListItem({
  comic, seriesId, onToggleRead,
}: {
  comic: Comic;
  seriesId: string;
  onToggleRead?: (file: string, isRead: boolean) => void;
}) {
  const inProgress = comic.currentPage > 0 && !comic.isRead;
  const progress = comic.pages > 0 ? Math.round((comic.currentPage / comic.pages) * 100) : 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !comic.isRead;
    updateProgress(seriesId, comic.file, { isRead: newState });
    onToggleRead?.(comic.file, newState);
  };

  // Number-box tint mirrors the Bindery prototype: success for read, accent
  // for in-progress, subtle bg + tertiary text for plain unread.
  const numBg = comic.isRead
    ? 'rgb(var(--success) / 0.15)'
    : inProgress
      ? 'rgb(var(--accent) / 0.15)'
      : 'var(--bg-subtle)';
  const numColor = comic.isRead
    ? 'var(--color-success)'
    : inProgress
      ? 'var(--color-accent)'
      : 'var(--text-tertiary)';

  // Chapter ordinal extracted from the file name (e.g. "Chapter 006.pdf" → 6).
  // The prototype shows the ordinal in the box; we fall back to "·" if the
  // ordinal can't be parsed so the box still renders cleanly.
  const ordinalMatch = comic.file.match(/(\d+(?:\.\d+)?)/);
  const ordinal = ordinalMatch ? ordinalMatch[1].replace(/^0+(\d)/, '$1') : '·';

  return (
    <Link
      to={`/read/${seriesId}/${comic.file}`}
      className="by-card by-card--interactive"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        background: 'var(--surface-card)',
        textDecoration: 'none',
      }}
    >
      {/* Number / read marker — click toggles read */}
      <button
        onClick={handleToggle}
        title={comic.isRead ? 'Mark as unread' : 'Mark as read'}
        aria-label={comic.isRead ? 'Mark as unread' : 'Mark as read'}
        className="bindery-nums"
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: numBg,
          color: numColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontWeight: 600,
          fontSize: 13,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {comic.isRead ? <Check size={16} strokeWidth={2.5} /> : ordinal}
      </button>

      {/* Title + sub + (in-progress) progress bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-body)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {comic.file.replace(/\.pdf$/i, '')}
        </div>
        <div
          className="bindery-nums"
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginTop: 2,
          }}
        >
          {comic.pages || '?'} pages
          {inProgress && <> · on page {comic.currentPage + 1}</>}
          {comic.partial && (
            <> · {comic.partial.successfulPages} of {comic.partial.totalPages} downloaded</>
          )}
        </div>
        {inProgress && (
          <div style={{ marginTop: 6, maxWidth: 220 }}>
            <ProgressBar value={progress} />
          </div>
        )}
      </div>

      {/* State badge */}
      <div style={{ flexShrink: 0 }}>
        {comic.partial ? (
          <Badge intent="warning" pill>
            <AlertTriangle size={10} strokeWidth={2.5} /> Partial
          </Badge>
        ) : comic.isRead ? (
          <Badge intent="success" pill>
            <Download size={0} style={{ display: 'none' }} />Read
          </Badge>
        ) : inProgress ? (
          <Badge intent="accent" pill>
            Reading · p.{comic.currentPage + 1}
          </Badge>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unread</span>
        )}
      </div>

      <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </Link>
  );
}
