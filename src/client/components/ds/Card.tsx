import type { ElementType, HTMLAttributes, ReactNode } from 'react';

/**
 * The canonical surface — theme-aware card / modal background, 1px border,
 * subtle shadow in light mode (none in dark). `interactive` adds the
 * accent hover-ring used on clickable cards.
 */
interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  interactive?: boolean;
  as?: ElementType;
}

export function Card({
  children,
  interactive = false,
  as: Tag = 'div',
  className = '',
  ...rest
}: CardProps) {
  const cls = ['by-card', interactive ? 'by-card--interactive' : '', className]
    .filter(Boolean).join(' ');
  return <Tag className={cls} {...rest}>{children}</Tag>;
}
