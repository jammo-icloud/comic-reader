import { useNavigate } from 'react-router-dom';
import { Check, AlertTriangle } from 'lucide-react';
import type { Comic } from '../lib/types';
import { getThumbnailUrl } from '../lib/api';
import { Badge, CoverThumb } from './ds';

/**
 * Bindery chapter card — the CoverThumb DS primitive with state badges
 * mapped 1:1 from the prototype's ChapterGrid:
 *   - read=true draws the success bottom strip
 *   - in-progress draws the accent progress strip + "p.X" accent badge
 *   - unread + partial draws the warning Partial badge with the ok/total fraction
 *   - read draws the Read success badge
 */
export default function ComicCard({
  comic, seriesId,
}: {
  comic: Comic;
  seriesId: string;
  /** Kept for callsite compatibility; covers always show the chapter only. */
  hideSeries?: boolean;
}) {
  const navigate = useNavigate();
  const inProgress = comic.currentPage > 0 && !comic.isRead;
  const progress = comic.pages > 0 ? Math.round((comic.currentPage / comic.pages) * 100) : 0;

  return (
    <CoverThumb
      src={getThumbnailUrl(seriesId, comic.file, comic.thumbHash)}
      alt={comic.file}
      title={comic.file.replace(/\.pdf$/i, '')}
      meta={<span className="bindery-nums">{comic.pages || '?'} pages</span>}
      onClick={() => navigate(`/read/${seriesId}/${comic.file}`)}
      read={comic.isRead}
      progress={inProgress ? progress : null}
      badgeTL={
        comic.partial ? (
          <Badge intent="warning" pill>
            <AlertTriangle size={9} strokeWidth={2.5} />
            {comic.partial.successfulPages}/{comic.partial.totalPages}
          </Badge>
        ) : null
      }
      badgeTR={
        comic.isRead ? (
          <Badge intent="success" pill>
            <Check size={9} strokeWidth={3} /> Read
          </Badge>
        ) : inProgress ? (
          <Badge intent="accent" pill>
            p.{comic.currentPage + 1}
          </Badge>
        ) : null
      }
    />
  );
}
