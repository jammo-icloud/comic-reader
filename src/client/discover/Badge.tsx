import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeIntent =
  | 'accent' | 'accent-soft'
  | 'success' | 'warning' | 'danger'
  | 'neutral' | 'new';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  intent?: BadgeIntent;
  pill?: boolean;
}

export function Badge({
  children,
  intent = 'neutral',
  pill = false,
  className = '',
  ...rest
}: BadgeProps) {
  const isNew = intent === 'new';
  const cls = [
    'by-badge',
    `by-badge--${intent}`,
    pill && !isNew ? 'by-badge--pill' : '',
    className,
  ].filter(Boolean).join(' ');
  return <span className={cls} {...rest}>{children}</span>;
}

export type SeriesStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled';

const STATUS_INTENT: Record<SeriesStatus, BadgeIntent> = {
  ongoing: 'success',
  completed: 'accent-soft',
  hiatus: 'warning',
  cancelled: 'danger',
};

export function StatusPill({ status, className = '' }: { status: SeriesStatus; className?: string }) {
  return <Badge intent={STATUS_INTENT[status] ?? 'neutral'} className={className}>{status}</Badge>;
}
