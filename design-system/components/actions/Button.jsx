import React from 'react';

/**
 * Bindery's primary button. Four intents (primary / secondary / ghost /
 * destructive) plus a `comic` variant for the login spread, and three sizes
 * mapped to the touch-target tokens.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  iconLeft = null,
  iconRight = null,
  className = '',
  ...rest
}) {
  const cls = [
    'by-btn',
    `by-btn--${variant}`,
    variant === 'comic' ? '' : `by-btn--${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={cls} disabled={disabled} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
