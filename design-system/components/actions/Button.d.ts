import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'comic';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Bindery's primary action button.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Intent. `comic` is the hard-shadow square login CTA. Default 'primary'. */
  variant?: ButtonVariant;
  /** Size — maps to touch-target tokens (sm=28, md=40, lg=44). Ignored for `comic`. Default 'md'. */
  size?: ButtonSize;
  /** Icon node rendered before the label (e.g. a Lucide icon). */
  iconLeft?: React.ReactNode;
  /** Icon node rendered after the label. */
  iconRight?: React.ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;
