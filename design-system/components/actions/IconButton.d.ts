import React from 'react';

export type IconButtonVariant = 'default' | 'primary' | 'destructive';

/**
 * 36×36 toolbar icon button with optional label and pressed state.
 */
export interface IconButtonProps {
  /** The icon node (e.g. a Lucide icon at size 18). */
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  /** Pressed / toggled state — tints with the accent (or fills, for primary). */
  active?: boolean;
  disabled?: boolean;
  /** Required — used for both `title` (tooltip) and `aria-label`. */
  title: string;
  /** Optional text label rendered beside the icon. */
  label?: string;
  variant?: IconButtonVariant;
  className?: string;
}

export function IconButton(props: IconButtonProps): JSX.Element;
