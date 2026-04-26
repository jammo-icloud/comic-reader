import { useEffect, useRef, useState } from 'react';

/**
 * A toolbar that becomes pinned to the top of the viewport when its sentinel
 * scrolls out of view. Use the `pinned` argument inside `children` to render
 * extra context (e.g. page name, back-arrow gutter) when pinned.
 *
 * Example:
 *   <StickyToolbar reservePinnedGutter>
 *     {(pinned) => (
 *       <>
 *         {pinned && <span className="font-medium truncate">{seriesName}</span>}
 *         <h2>Chapters ({count})</h2>
 *         …controls…
 *       </>
 *     )}
 *   </StickyToolbar>
 *
 * When `reservePinnedGutter` is true, horizontal padding bumps to leave room
 * for the floating top-left/right corner buttons (Back arrow / ⋯ menu) that
 * sit at `fixed top-3 left-3` and `fixed top-3 right-3`.
 *
 * `top` defaults to 0 (sticks to viewport top). Pass a CSS length (e.g. `56px`)
 * to stick below another sticky element like a page header.
 */
interface StickyToolbarProps {
  children: (pinned: boolean) => React.ReactNode;
  /** Reserve `pl-14 pr-14` when pinned so floating corner buttons don't overlap. */
  reservePinnedGutter?: boolean;
  /** Reserve only the right gutter (e.g. when there's no left floating button). */
  reservePinnedGutterRight?: boolean;
  /**
   * Pixel offset from the viewport top where the toolbar pins. Use this to
   * stack below a sticky page header. Also feeds the IntersectionObserver's
   * `rootMargin` so `pinned` flips at exactly the right scroll position.
   */
  topPx?: number;
  /** Extra classes for the outer (sticky-positioned) container. */
  className?: string;
  /** Extra classes for the inner `max-w` content row. */
  innerClassName?: string;
}

export default function StickyToolbar({
  children,
  reservePinnedGutter,
  reservePinnedGutterRight,
  topPx = 0,
  className = '',
  innerClassName = '',
}: StickyToolbarProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    // Shrink the observer's effective viewport top by topPx so the sentinel
    // is reported as "not intersecting" once it scrolls past the sticky line.
    const obs = new IntersectionObserver(
      ([entry]) => setPinned(!entry.isIntersecting),
      { threshold: 0, rootMargin: `${-topPx}px 0px 0px 0px` },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [topPx]);

  const gutter = reservePinnedGutter
    ? (pinned ? 'pl-14 pr-14' : 'px-4 sm:px-6')
    : reservePinnedGutterRight
      ? (pinned ? 'pl-4 sm:pl-6 pr-14' : 'px-4 sm:px-6')
      : 'px-4 sm:px-6';

  return (
    <>
      <div ref={sentinelRef} className="h-px" />
      <div
        className={`sticky z-20 bg-gray-50/85 dark:bg-gray-950/85 backdrop-blur-md transition-shadow ${
          pinned
            ? 'shadow-md border-b border-gray-200 dark:border-gray-800'
            : 'border-b border-gray-200/60 dark:border-gray-800/60'
        } ${className}`}
        style={{ top: `${topPx}px` }}
      >
        <div className={`max-w-6xl mx-auto py-2.5 flex items-center gap-2 transition-[padding] ${gutter} ${innerClassName}`}>
          {children(pinned)}
        </div>
      </div>
    </>
  );
}
