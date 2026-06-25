import React from 'react';

/**
 * Small status / meta badge. Intent maps to a semantic color; `new` is the
 * accent-filled uppercase chip used on series covers with fresh chapters.
 */
export function Badge({ children, intent = 'neutral', pill = false, className = '', ...rest }) {
  const isNew = intent === 'new';
  const cls = [
    'by-badge',
    `by-badge--${intent}`,
    pill && !isNew ? 'by-badge--pill' : '',
    className,
  ].filter(Boolean).join(' ');
  return <span className={cls} {...rest}>{children}</span>;
}

/**
 * Status pill mapped to a series' publication status, per the design system:
 *   ongoing → success · completed → accent-soft · hiatus → warning · cancelled → danger
 */
export function StatusPill({ status, className = '' }) {
  const map = {
    ongoing: 'success',
    completed: 'accent-soft',
    hiatus: 'warning',
    cancelled: 'danger',
  };
  const intent = map[status] || 'neutral';
  return <Badge intent={intent} className={className}>{status}</Badge>;
}
