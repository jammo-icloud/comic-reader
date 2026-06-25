import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Compass, FolderPlus, Shield, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../App';
import { useTheme } from '../lib/theme';
import { ALL_THEMES } from '../lib/themes';
import { Avatar, SegmentedControl } from './ds';

/**
 * Right-anchored profile menu sheet — avatar + nav rows + mode toggle +
 * 12-theme picker + settings + sign out. Rendered globally by App; the
 * Header's avatar button toggles `open`.
 */
interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileSheet({ open, onClose }: ProfileSheetProps) {
  const navigate = useNavigate();
  const { username, isAdmin, logout } = useAuth();
  const { theme, isDark, setTheme, toggleDarkLight } = useTheme();

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
          right: 12,
          top: 56,
          width: 288,
          background: 'var(--surface-raised)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-2xl)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
          maxHeight: '85vh',
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

        {/* Mode (light/dark) toggle within the active pair */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--text-heading)' }}>Mode</span>
          <SegmentedControl
            options={[
              { value: 'light', label: '', icon: <Sun size={14} /> },
              { value: 'dark', label: '', icon: <Moon size={14} /> },
            ]}
            value={isDark ? 'dark' : 'light'}
            onChange={(v) => {
              if ((v === 'dark') !== isDark) toggleDarkLight();
            }}
          />
        </div>

        {/* Theme picker — all 12 in a 4-col grid */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 16px' }}>
          <div className="by-kicker" style={{ marginBottom: 8 }}>Theme</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {ALL_THEMES.map((t) => {
              const selected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  title={`${t.name} — ${t.description}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '7px 4px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: selected
                      ? '2px solid var(--color-accent)'
                      : '1px solid var(--border-default)',
                    background: t.bg,
                    color: t.text,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: t.accent,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 9, opacity: 0.85 }}>{t.name}</span>
                </button>
              );
            })}
          </div>
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
