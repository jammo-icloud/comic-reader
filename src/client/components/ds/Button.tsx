import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Bindery's primary button. Four intents (primary / secondary / ghost /
 * destructive) plus a `comic` variant for the login spread, and three sizes
 * mapped to the touch-target tokens.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'comic';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: Variant;
  size?: Size;
  type?: 'button' | 'submit' | 'reset';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  iconLeft = null,
  iconRight = null,
  className = '',
  ...rest
}: ButtonProps) {
  const cls = [
    'by-btn',
    `by-btn--${variant}`,
    variant === 'comic' ? '' : `by-btn--${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={cls} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
