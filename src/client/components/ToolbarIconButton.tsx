/**
 * Square icon button for sticky toolbars and chip rows.
 * 36×36 touch target, with an `active` style for pressed/toggled state.
 */
interface ToolbarIconButtonProps {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  /** Optional text label rendered alongside the icon at sm: and up. */
  label?: string;
  /** Variant: 'default' (subtle), 'primary' (blue), 'destructive' (red). */
  variant?: 'default' | 'primary' | 'destructive';
}

export default function ToolbarIconButton({
  children, onClick, active, disabled, title, label, variant = 'default',
}: ToolbarIconButtonProps) {
  const base = 'rounded-md transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center disabled:opacity-50';
  const padding = label ? 'px-2.5 sm:px-3 gap-1.5' : 'p-2';

  const palette = (() => {
    if (active) {
      if (variant === 'primary') return 'bg-accent text-white';
      if (variant === 'destructive') return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
      return 'bg-accent/20 text-accent';
    }
    if (variant === 'primary') return 'bg-accent hover:bg-accent text-white';
    if (variant === 'destructive') return 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20';
    return 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800';
  })();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`${base} ${padding} ${palette}`}
    >
      {children}
      {label && <span className="hidden sm:inline text-xs font-medium">{label}</span>}
    </button>
  );
}
