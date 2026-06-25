import { useLocation, useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '../App';
import { Avatar, IconButton } from './ds';
import NotificationDropdown from './NotificationDropdown';

/**
 * Bindery's slim sticky page header: brand mark on the left, Discover toggle +
 * notifications + profile avatar on the right. Glass-tinted via --chrome-bg so
 * the active theme bleeds through.
 *
 * `onOpenProfile` is the click handler the avatar fires when tapped; the
 * ProfileSheet is rendered globally and toggled by App.
 */
interface HeaderProps {
  onOpenProfile: () => void;
}

export default function Header({ onOpenProfile }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = useAuth();
  const isDiscover = location.pathname.startsWith('/discover');

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'var(--chrome-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '6px 16px',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          onClick={() => navigate('/')}
          aria-label="Library"
          title="Library"
          style={{
            display: 'flex',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <img
            src="/bindery-logo.png"
            alt="Bindery"
            width={32}
            height={32}
            style={{ borderRadius: 6, display: 'block' }}
          />
        </button>
        <div style={{ flex: 1 }} />
        <IconButton
          title="Discover"
          active={isDiscover}
          onClick={() => navigate('/discover')}
        >
          <Compass size={18} />
        </IconButton>
        <NotificationDropdown />
        <button
          onClick={onOpenProfile}
          aria-label="Profile menu"
          title="Profile menu"
          style={{
            padding: 4,
            borderRadius: '50%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Avatar username={username} size="md" />
        </button>
      </div>
    </header>
  );
}
