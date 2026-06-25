import React from 'react';

export type BadgeIntent =
  | 'neutral' | 'accent' | 'accent-soft' | 'success' | 'warning' | 'danger' | 'new';

export interface BadgeProps {
  children: React.ReactNode;
  /** Color intent. `new` is the lifted accent chip for fresh-chapter covers. */
  intent?: BadgeIntent;
  /** Fully-rounded pill shape (ignored for `new`, which is always rounded). */
  pill?: boolean;
  className?: string;
}

export interface StatusPillProps {
  /** Series publication status. */
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | string;
  className?: string;
}

export function Badge(props: BadgeProps): JSX.Element;
export function StatusPill(props: StatusPillProps): JSX.Element;
