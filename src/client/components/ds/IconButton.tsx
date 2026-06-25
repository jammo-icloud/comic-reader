import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Square 36×36 icon button for sticky toolbars and chip rows. Optional text
 * label appears alongside the icon. `active` reflects a pressed/toggled state.
 */
type Variant = 'default' | 'primary' | 'destructive';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  children: ReactNode;
  active?: boolean;
  title: string;
  label?: string;
  variant?: Variant;
}

export function IconButton({
  children,
  active = false,
  title,
  label,
  variant = 'default',
  className = '',
  ...rest
}: IconButtonProps) {
  const cls = [
    'by-icon-btn',
    variant !== 'default' ? `by-icon-btn--${variant}` : '',
    label ? 'by-icon-btn--label' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      title={title}
      aria-label={title}
      aria-pressed={active}
      {...rest}
    >
      {children}
      {label && <span className="by-icon-btn__label">{label}</span>}
    </button>
  );
}
