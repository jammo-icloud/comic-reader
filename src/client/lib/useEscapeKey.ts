import { useEffect } from 'react';

/**
 * Calls `handler` when the user presses Escape, but only while `enabled`.
 *
 * Used by every modal/sheet/popover that should close on Esc.
 * Pair with `aria-modal="true"` and a backdrop click-to-close for full keyboard
 * + pointer dismiss coverage.
 */
export function useEscapeKey(handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handler, enabled]);
}
