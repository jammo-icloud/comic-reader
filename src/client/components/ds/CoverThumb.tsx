import type { ElementType, ReactNode, MouseEvent } from 'react';

/**
 * The signature Bindery cover card — a 2:3 cover with corner-anchored badges,
 * an optional bottom progress strip, and a title/meta footer. Powers the
 * library grid, series covers, and comic-chapter thumbnails.
 *
 * Badges are placed by corner: badgeTL / badgeTR / badgeBL accept any node
 * (commonly a <Badge>). `progress` (0–100) draws the accent strip along the
 * bottom of the art; `read` draws a solid success strip instead.
 */
interface CoverThumbProps {
  src?: string | null;
  alt?: string;
  title?: ReactNode;
  meta?: ReactNode;
  href?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  blurred?: boolean;
  progress?: number | null;
  read?: boolean;
  badgeTL?: ReactNode;
  badgeTR?: ReactNode;
  badgeBL?: ReactNode;
  topEdgeColor?: string | null;
  className?: string;
}

export function CoverThumb({
  src,
  alt = '',
  title,
  meta,
  href,
  onClick,
  blurred = false,
  progress = null,
  read = false,
  badgeTL = null,
  badgeTR = null,
  badgeBL = null,
  topEdgeColor = null,
  className = '',
}: CoverThumbProps) {
  const Tag: ElementType = href ? 'a' : onClick ? 'button' : 'div';
  const extra: Record<string, unknown> = href
    ? { href }
    : onClick
      ? { type: 'button', onClick }
      : {};

  return (
    <Tag className={`by-cover ${className}`} {...extra}>
      {topEdgeColor && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: topEdgeColor, zIndex: 2,
          }}
        />
      )}
      <div className="by-cover__art">
        {src
          ? <img src={src} alt={alt} loading="lazy" style={blurred ? { filter: 'blur(16px)' } : undefined} />
          : <div style={{ width: '100%', height: '100%' }} />}
        {badgeTL && <div className="by-cover__badge by-cover__badge--tl">{badgeTL}</div>}
        {badgeTR && <div className="by-cover__badge by-cover__badge--tr">{badgeTR}</div>}
        {badgeBL && <div className="by-cover__badge by-cover__badge--bl">{badgeBL}</div>}
        {read ? (
          <div className="by-cover__strip" style={{ background: 'var(--color-success)' }} />
        ) : progress != null && progress > 0 ? (
          <div className="by-cover__strip">
            <div className="by-cover__strip-fill" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        ) : null}
      </div>
      {(title || meta) && (
        <div className="by-cover__body">
          {title && <h3 className="by-cover__title">{title}</h3>}
          {meta && <div className="by-cover__meta">{meta}</div>}
        </div>
      )}
    </Tag>
  );
}
