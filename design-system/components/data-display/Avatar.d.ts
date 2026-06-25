import React from 'react';

export interface AvatarProps {
  /** The username — its first letter becomes the avatar glyph. */
  username: string | null | undefined;
  /** sm=24 · md=32 · lg=44. Default 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** `onDark` = dim white-on-translucent, for use over dark cover heroes. */
  variant?: 'default' | 'onDark';
  className?: string;
}

export function Avatar(props: AvatarProps): JSX.Element;
