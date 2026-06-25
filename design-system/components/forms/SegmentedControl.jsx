import React from 'react';

/**
 * Segmented control — a row of mutually-exclusive options on a subtle track.
 * Used for the Library type tabs (Comics / Magazines) and the theme toggle.
 */
export function SegmentedControl({ options, value, onChange, className = '' }) {
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
            onClick={() => onChange && onChange(val)}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
