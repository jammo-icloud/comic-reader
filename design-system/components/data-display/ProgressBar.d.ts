import React from 'react';

export interface ProgressBarProps {
  /** 0–100 (clamped). Reading progress, download progress, etc. */
  value: number;
  className?: string;
}

export function ProgressBar(props: ProgressBarProps): JSX.Element;
