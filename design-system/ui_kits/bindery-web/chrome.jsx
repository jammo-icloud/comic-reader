/* Bindery UI kit — shared chrome: page header + profile menu sheet. */

const { Avatar, IconButton, SegmentedControl } = window.DS;

/* Slim sticky page header (Library / Discover shape). */
function Header({ onNav, onOpenMenu, route }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'var(--chrome-bg)', backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-default)',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '6px 16px', height: 48, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => onNav('library')} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <img src={window.ART.fox} alt="Bindery" width="32" height="32" style={{ borderRadius: 6 }} />
        </button>
        <div style={{ flex: 1 }} />
        <IconButton title="Discover" active={route === 'discover'} onClick={() => onNav('discover')}><Ic name="compass" /></IconButton>
        <NotificationBell />
        <button onClick={onOpenMenu} title="Profile" aria-label="Profile menu"
          style={{ padding: 4, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Avatar username="Jammo" size="md" />
        </button>
      </div>
    </header>
  );
}

function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <IconButton title="Notifications" onClick={() => setOpen(o => !o)}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <Ic name="bell" />
          <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', boxShadow: '0 0 0 2px var(--bg-page)' }} />
        </span>
      </IconButton>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, width: 280, background: 'var(--surface-raised)', border: '1px solid var(--border-default)', borderRadius: 12, boxShadow: 'var(--shadow-2xl)', zIndex: 50, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }} className="bindery-kicker">Notifications</div>
          {[['Frieren', '3 new chapters synced'], ['Dungeon Meshi', '2 new chapters synced'], ['Witch Hat Atelier', '1 new chapter synced']].map(([t, d], i) => (
            <div key={i} style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--color-accent)', marginTop: 1 }}><Ic name="book-open" size={16} /></span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-body)' }}>{t}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Profile menu — bottom-sheet feel rendered as a right-anchored dropdown. */
function ProfileSheet({ open, onClose, onNav, theme, setTheme, dark, setDark }) {
  if (!open) return null;
  const Row = ({ icon, label, onClick, destructive }) => (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      color: destructive ? 'var(--color-danger)' : 'var(--text-body)', fontSize: 14,
    }}
      onMouseEnter={e => e.currentTarget.style.background = destructive ? 'rgb(var(--danger)/0.1)' : 'var(--bg-subtle)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      <span style={{ color: destructive ? 'var(--color-danger)' : 'var(--text-tertiary)', display: 'inline-flex' }}>{icon}</span>
      {label}
    </button>
  );
  const themes = [
    ['', 'Default'], ['midnight', 'Midnight'], ['mocha', 'Mocha'], ['tankobon-dark', 'Tankobon'],
    ['latte', 'Latte'], ['dawn', 'Dawn'], ['gruvbox-sand', 'Gruvbox'], ['newsprint', 'Newsprint'],
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', inset: 0, background: 'rgb(0 0 0 / 0.1)', border: 'none', cursor: 'pointer' }} />
      <div role="dialog" aria-modal="true" style={{
        position: 'fixed', right: 12, top: 56, width: 288,
        background: 'var(--surface-raised)', borderRadius: 12, boxShadow: 'var(--shadow-2xl)',
        border: '1px solid var(--border-default)', overflow: 'hidden', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar username="Jammo" size="lg" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Jammo
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 4, background: 'rgb(var(--accent)/0.15)', color: 'var(--color-accent)', fontWeight: 600 }}>Admin</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Signed in</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Row icon={<Ic name="home" size={16} />} label="Library" onClick={() => { onClose(); onNav('library'); }} />
          <Row icon={<Ic name="compass" size={16} />} label="Discover" onClick={() => { onClose(); onNav('discover'); }} />
          <Row icon={<Ic name="folder-plus" size={16} />} label="Import" onClick={onClose} />
          <Row icon={<Ic name="shield" size={16} />} label="Admin" onClick={() => { onClose(); onNav('admin'); }} />
        </div>
        {/* Theme — light/dark */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: 'var(--text-heading)' }}>Mode</span>
          <SegmentedControl
            options={[{ value: 'light', label: '', icon: <Ic name="sun" size={14} /> }, { value: 'dark', label: '', icon: <Ic name="moon" size={14} /> }]}
            value={dark ? 'dark' : 'light'} onChange={v => setDark(v === 'dark')} />
        </div>
        {/* Theme picker */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 16px' }}>
          <div className="bindery-kicker" style={{ marginBottom: 8 }}>Theme</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {themes.map(([id, name]) => (
              <button key={id} onClick={() => setTheme(id)} title={name}
                data-theme={id}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '7px 4px',
                  borderRadius: 8, cursor: 'pointer',
                  border: theme === id ? '2px solid var(--color-accent)' : '1px solid var(--border-default)',
                  background: 'var(--surface-card)',
                }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgb(var(--accent))' }} />
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{name}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Row icon={<Ic name="settings" size={16} />} label="Settings" onClick={onClose} />
        </div>
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <Row icon={<Ic name="log-out" size={16} />} label="Sign out" destructive onClick={() => { onClose(); onNav('login'); }} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Header, ProfileSheet });
