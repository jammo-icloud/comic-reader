import React from 'react';

/**
 * The canonical surface — theme-aware card / modal background, 1px border,
 * subtle shadow in light mode (none in dark). `interactive` adds the
 * accent hover-ring used on clickable cards.
 */
export function Card({ children, interactive = false, as = 'div', className = '', ...rest }) {
  const Tag = as;
  const cls = ['by-card', interactive ? 'by-card--interactive' : '', className]
    .filter(Boolean).join(' ');
  return <Tag className={cls} {...rest}>{children}</Tag>;
}
