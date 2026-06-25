import type { ReactNode } from 'react';

/**
 * Segmented control — a row of mutually-exclusive options on a subtle track.
 * Used for the Library type tabs (Comics / Magazines) and the theme toggle.
 */
export type SegmentedOption<T extends string> = T | {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
};

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div className={`by-segmented ${className}`} role="group">
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const icon = typeof opt === 'string' ? null : opt.icon;
        const selected = val === value;
        return (
          <button
            key={val}
            type="button"
            className="by-segment"
            aria-pressed={selected}
            onClick={() => onChange(val)}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
