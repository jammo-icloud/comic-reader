import type { InputHTMLAttributes } from 'react';

/**
 * Text input. Default is the standard rounded field; `comic` is the
 * hard-bordered monospace field used on the login spread.
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'comic';
}

export function Input({ variant = 'default', className = '', ...rest }: InputProps) {
  const cls = ['by-input', variant === 'comic' ? 'by-input--comic' : '', className]
    .filter(Boolean).join(' ');
  return <input className={cls} {...rest} />;
}
