import type { HTMLAttributes, ReactNode } from 'react';

/** A tag / genre chip — subtle filled pill of tertiary text. */
interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function Tag({ children, className = '', ...rest }: TagProps) {
  return <span className={`by-tag ${className}`} {...rest}>{children}</span>;
}
