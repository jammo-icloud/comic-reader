import type { ElementType, HTMLAttributes, ReactNode } from 'react';

/** Uppercase, tracked eyebrow label — section headers, kicker text. */
interface KickerProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  count?: number | null;
  as?: ElementType;
}

export function Kicker({
  children,
  count,
  as: Tag = 'h2',
  className = '',
  ...rest
}: KickerProps) {
  return (
    <Tag className={`by-kicker ${className}`} {...rest}>
      {children}
      {count != null && (
        <span
          style={{
            marginLeft: 6,
            color: 'var(--text-muted)',
            fontWeight: 500,
            textTransform: 'none',
            letterSpacing: 'normal',
          }}
        >
          · {count}
        </span>
      )}
    </Tag>
  );
}
