import React from 'react';

/** A tag / genre chip — subtle filled pill of tertiary text. */
export function Tag({ children, className = '', ...rest }) {
  return <span className={`by-tag ${className}`} {...rest}>{children}</span>;
}
