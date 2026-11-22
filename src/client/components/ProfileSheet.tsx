import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Compass, FolderPlus, Shield, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../App';
import { Avatar } from './ds';

/** Preferred panel width; shrinks on viewports narrower than this + margins. */
const SHEET_WIDTH = 288;
/** Minimum gap between the panel and the viewport edges. */
const EDGE_GAP = 8;
/** Gap between the anchor's bottom edge and the panel. */
const ANCHOR_GAP = 6;

/**
 * Profile menu sheet — avatar + nav rows + settings + sign out. Theme and
 * light/dark mode live on the Settings page, not here. Rendered globally by
 * App; the Header's avatar button toggles `open` and is passed as
 * `anchorRef` so the panel can sit directly beneath it.
 */
interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  /** The avatar button the panel hangs from. Falls back to the top-right corner. */
  anchorRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Where to put the panel: right-aligned with the anchor's right edge, just
 * below it, then clamped so it never leaves the viewport on any width.
 */
function computePlacement(anchor: HTMLElement | null): CSSProperties {
  // Layout viewport width (excludes a classic scrollbar), which is what
  // `position: fixed; right` is measured against — `innerWidth` is not.
  const vw = document.documentElement.clientWidth;
  const width = Math.min(SHEET_WIDTH, vw - EDGE_GAP * 2);
  const rect = anchor?.getBoundingClientRect();
  // Distance from the viewport's right edge to the panel's right edge.
  let right = rect ? vw - rect.right : 12;
  right = Math.max(EDGE_GAP, Math.min(right, vw - EDGE_GAP - width));
  const top = rect ? rect.bottom + ANCHOR_GAP : 56;
  return { right, top, width, maxHeight: `calc(100dvh - ${top + EDGE_GAP}px)` };
}

export default function ProfileSheet({ open, onClose, anchorRef }: ProfileSheetProps) {
  const navigate = useNavigate();
  const { username, isAdmin, logout } = useAuth();
  const [placement, setPlacement] = useState<CSSProperties>({});

  // Measure the anchor when the sheet opens and whenever the viewport
  // changes, so the panel tracks the avatar at every width.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => setPlacement(computePlacement(anchorRef?.current ?? null));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, anchorRef]);

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleSignOut = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgb(0 0 0 / 0.1)',
          border: 'none',
          cursor: 'pointer',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          ...placement,
          background: 'var(--surface-raised)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-2xl)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
          overflowY: 'auto',
        }}
      >
        {/* Identity header */}
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar username={username} size="lg" />
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-body)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {username || '—'}
              {isAdmin && (
                <span
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgb(var(--accent) / 0.15)',
                    color: 'var(--color-accent)',
                    fontWeight: 600,
                  }}
                >
                  Admin
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Signed in</div>
          </div>
        </div>

        {/* Primary nav */}
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Row icon={<Home size={16} />} label="Library" onClick={() => go('/')} />
          <Row icon={<Compass size={16} />} label="Discover" onClick={() => go('/discover')} />
          <Row icon={<FolderPlus size={16} />} label="Import" onClick={() => go('/import')} />
          {isAdmin && <Row icon={<Shield size={16} />} label="Admin" onClick={() => go('/admin')} />}
        </div>

        {/* Settings */}
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Row icon={<Settings size={16} />} label="Settings" onClick={() => go('/settings')} />
        </div>

        {/* Sign out */}
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Row icon={<LogOut size={16} />} label="Sign out" destructive onClick={handleSignOut} />
        </div>
      </div>
    </div>
  );
}

/** One row inside the profile sheet — icon + label, hover-tinted. */
function Row({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        color: destructive ? 'var(--color-danger)' : 'var(--text-body)',
        fontSize: 14,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = destructive
          ? 'rgb(var(--danger) / 0.1)'
          : 'var(--bg-subtle)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'none';
      }}
    >
      <span
        style={{
          color: destructive ? 'var(--color-danger)' : 'var(--text-tertiary)',
          display: 'inline-flex',
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}
