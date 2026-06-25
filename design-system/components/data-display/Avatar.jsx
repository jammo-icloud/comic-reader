import React from 'react';

/**
 * Initial-circle avatar — the identity glyph for a logged-in user. Picks up the
 * active theme's accent. `onDark` variant is for use over dark cover heroes.
 */
export function Avatar({ username, size = 'md', variant = 'default', className = '' }) {
  const initial = username && username.length > 0 ? username[0].toUpperCase() : '?';
  const cls = [
    'by-avatar',
    `by-avatar--${size}`,
    variant === 'onDark' ? 'by-avatar--on-dark' : '',
    className,
  ].filter(Boolean).join(' ');
  return <span aria-hidden="true" className={cls}>{initial}</span>;
}
