import React from 'react';

/**
 * The signature Bindery cover card — series, comic, and discover thumbnails.
 */
export interface CoverThumbProps {
  /** Cover image URL. Omit for an empty placeholder tile. */
  src?: string | null;
  alt?: string;
  /** Title shown in the footer (truncates). */
  title?: string;
  /** Secondary meta line (year, chapter count, etc.) — string or node. */
  meta?: React.ReactNode;
  /** Render as a link. */
  href?: string;
  /** Render as a button. */
  onClick?: (e: React.MouseEvent) => void;
  /** Blur the art (NSFW covers). */
  blurred?: boolean;
  /** Reading progress 0–100 → accent strip along the bottom of the art. */
  progress?: number | null;
  /** Fully-read → solid success strip (overrides `progress`). */
  read?: boolean;
  /** Badge node anchored top-left (e.g. "Saved"). */
  badgeTL?: React.ReactNode;
  /** Badge node anchored top-right (e.g. NEW chip or status). */
  badgeTR?: React.ReactNode;
  /** Badge node anchored bottom-left (e.g. pin marker). */
  badgeBL?: React.ReactNode;
  /** 3px colored top edge (e.g. per-source accent on Discover results). */
  topEdgeColor?: string | null;
  className?: string;
}

export function CoverThumb(props: CoverThumbProps): JSX.Element;
