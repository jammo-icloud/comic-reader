import React from 'react';

/** Uppercase, tracked eyebrow label — section headers, kicker text. */
export function Kicker({ children, count, as = 'h2', className = '', ...rest }) {
  const Tag = as;
  return (
    <Tag className={`by-kicker ${className}`} {...rest}>
      {children}
      {count != null && (
        <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>
          · {count}
        </span>
      )}
    </Tag>
  );
}
