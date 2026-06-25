import React from 'react';

export interface KickerProps {
  children: React.ReactNode;
  /** Optional count appended as " · N" in normal-case muted text. */
  count?: number;
  /** Element to render as. Default 'h2'. */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

export function Kicker(props: KickerProps): JSX.Element;
