import React from 'react';

/**
 * Square 36×36 icon button for sticky toolbars and chip rows. Optional text
 * label appears alongside the icon. `active` reflects a pressed/toggled state.
 */
export function IconButton({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
  label,
  variant = 'default',
  className = '',
  ...rest
}) {
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
      onClick={onClick}
      disabled={disabled}
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
