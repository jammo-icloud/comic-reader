import type { HTMLAttributes } from 'react';

/** Thin themed progress bar — accent fill on a track. Clamps 0–100. */
interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'aria-valuenow' | 'aria-valuemin' | 'aria-valuemax'> {
  value: number;
}

export function ProgressBar({ value, className = '', ...rest }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`by-progress ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...rest}
    >
      <div className="by-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
