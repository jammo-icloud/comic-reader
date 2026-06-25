import React from 'react';

/**
 * The canonical card / modal surface.
 */
export interface CardProps {
  children: React.ReactNode;
  /** Adds the accent hover-ring + pointer for clickable cards. */
  interactive?: boolean;
  /** Element to render as (e.g. 'a', 'button', 'section'). Default 'div'. */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

export function Card(props: CardProps): JSX.Element;
