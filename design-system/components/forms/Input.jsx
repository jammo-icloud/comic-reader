import React from 'react';

/**
 * Text input. Default is the standard rounded field; `comic` is the
 * hard-bordered monospace field used on the login spread.
 */
export function Input({ variant = 'default', className = '', ...rest }) {
  const cls = ['by-input', variant === 'comic' ? 'by-input--comic' : '', className]
    .filter(Boolean).join(' ');
  return <input className={cls} {...rest} />;
}
