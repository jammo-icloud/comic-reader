/**
 * Initial-circle avatar — the primary identity glyph for a logged-in user.
 *
 * Default variant: accent-tinted circle with the username's first letter
 *   (theme-aware — picks up the active theme's `--accent`).
 * `onDark` variant: dim white-on-translucent, intended for use over the floating
 * `bg-black/40 backdrop-blur-md` buttons on Reader/Series page heroes.
 */
interface AvatarProps {
  username: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'onDark';
  className?: string;
}

export default function Avatar({
  username, size = 'md', variant = 'default', className = '',
}: AvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-[11px]',
    md: 'w-8 h-8 text-sm',
    lg: 'w-11 h-11 text-base',
  }[size];

  const palette = variant === 'onDark'
    ? 'bg-white/20 text-white ring-1 ring-white/20'
    : 'bg-accent/15 text-accent';

  const initial = username && username.length > 0 ? username[0].toUpperCase() : '?';

  return (
    <span
      aria-hidden="true"
      className={`${sizeClasses} ${palette} rounded-full flex items-center justify-center font-bold shrink-0 ${className}`}
    >
      {initial}
    </span>
  );
}
