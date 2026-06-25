import React from 'react';

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps {
  /** Options — plain strings, or {value, label, icon} objects. */
  options: Array<string | SegmentedOption>;
  /** Currently-selected value. */
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
