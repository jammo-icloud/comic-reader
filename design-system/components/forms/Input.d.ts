import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** `comic` = hard black border + monospace (login spread). Default 'default'. */
  variant?: 'default' | 'comic';
}

export function Input(props: InputProps): JSX.Element;
