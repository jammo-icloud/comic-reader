/* Bindery UI kit — Admin (4 tabs: Library, Tasks, Subscriptions, Users).
   UX fix vs. the original: the bulk maintenance actions (Run maintenance,
   Cleanup, Rescan, Re-enrich, Sync all) were buried inside the personal
   profile/avatar menu. They live in a dedicated header "Tools" menu here. */

const { Button, IconButton, Badge, Avatar, ProgressBar, Kicker, Card } = window.DS;
const A = window.ADMIN_STATS;

function Admin({ onBack, onOpenMenu }) {
  const [tab, setTab] = React.useState('library');
  const [search, setSearch] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const [attention, setAttention] = React.useState(false);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set());
  const [confirm, setConfirm] = React.useState(null);

  const catalog = window.SERIES;
  const filtered = catalog.filter(s =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase())) &&
    (!attention || !s.en));

  const toggleSel = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else if (next.size < 2) next.add(id);
    return next;
  });

  const tabs = ['library', 'tasks', 'subscriptions', 'users'];
  const tabLabel = { library: 'Library', tasks: 'Tasks', subscriptions: 'Subscriptions', users: 'Users' };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-page)', paddingBottom: selectMode ? 80 : 0 }}>
      {/* ===== Two-row sticky header ===== */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--chrome-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton title="Back to library" onClick={onBack}><Ic name="arrow-left" size={20} /></IconButton>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-body)' }}>Admin</h1>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>v{A.version}</span>
          <div style={{ flex: 1 }} />
          <ToolsMenu onConfirm={setConfirm} />
          <button onClick={onOpenMenu} title="Profile" aria-label="Profile menu" style={{ padding: 4, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Avatar username="Jammo" size="md" />
          </button>
        </div>
        {/* Tab strip */}
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 8px', display: 'flex', overflowX: 'auto' }} className="no-scrollbar">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '12px 16px', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: '2px solid ' + (tab === t ? 'var(--color-accent)' : 'transparent'),
              color: tab === t ? 'var(--color-accent)' : 'var(--text-tertiary)',
            }}>{tabLabel[t]}</button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '16px' }}>
        {/* ===== Stat cards ===== */}
        <StatRow tab={tab} subs={window.SUBSCRIPTIONS} users={window.USERS} catalog={catalog} />

        {/* ===== Per-tab toolbar ===== */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 12px' }}>
          {tab === 'library' && <>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-heading)' }}>Library <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({filtered.length})</span></h2>
            {showSearch && <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search series…" className="by-input" style={{ flex: 1, height: 36, maxWidth: 280 }} />}
            <div style={{ flex: 1 }} />
            <IconButton title={showSearch ? 'Close search' : 'Search'} active={showSearch} onClick={() => { setShowSearch(s => !s); if (showSearch) setSearch(''); }}><Ic name={showSearch ? 'x' : 'search'} size={16} /></IconButton>
            <IconButton title="Show only series needing attention" label="Attention" active={attention} onClick={() => setAttention(a => !a)}><Ic name="circle-alert" size={16} /></IconButton>
            <IconButton title="Select for merge" label={selectMode ? (selected.size ? selected.size + '/2' : 'Select') : 'Select'} active={selectMode} onClick={() => { setSelectMode(m => !m); setSelected(new Set()); }}><Ic name="git-merge" size={16} /></IconButton>
          </>}
          {tab === 'tasks' && <>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-heading)' }}>Download tasks</h2>
            <div style={{ flex: 1 }} />
            <IconButton title="Refresh" onClick={() => {}}><Ic name="refresh-cw" size={16} /></IconButton>
            <IconButton title="Clear completed" label="Clear" variant="destructive" onClick={() => setConfirm({ title: 'Clear completed tasks?', msg: 'Removes finished and errored downloads from the list. In-progress tasks are unaffected.', label: 'Clear' })}><Ic name="trash-2" size={16} /></IconButton>
          </>}
          {tab === 'subscriptions' && <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-heading)' }}>Subscriptions <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({window.SUBSCRIPTIONS.length})</span></h2>}
          {tab === 'users' && <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-heading)' }}>Registered users</h2>}
        </div>

        {/* ===== Tab content ===== */}
        {tab === 'library' && <LibraryTab rows={filtered} total={catalog.length} selectMode={selectMode} selected={selected} onToggle={toggleSel} onDelete={(s) => setConfirm({ title: `Delete "${s.name}"?`, msg: `Permanently removes ${s.ch} chapters and the series metadata.`, label: 'Delete', danger: true })} />}
        {tab === 'tasks' && <TasksTab tasks={window.TASKS} />}
        {tab === 'subscriptions' && <SubsTab subs={window.SUBSCRIPTIONS} onUnsub={(s) => setConfirm({ title: `Unsubscribe "${s.name}"?`, msg: 'New chapters will no longer be auto-downloaded. Existing chapters stay in your library.', label: 'Unsubscribe' })} />}
        {tab === 'users' && <UsersTab users={window.USERS} />}
      </div>

      {/* ===== Merge selection footer ===== */}
      {tab === 'library' && selectMode && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, background: 'var(--chrome-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid var(--border-default)', boxShadow: 'var(--shadow-2xl)' }}>
          <div style={{ maxWidth: 1152, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)' }}>
              {selected.size === 0 ? 'Select 2 series to merge' : selected.size === 1 ? '1 selected — pick one more' : '2 selected'}
            </span>
            <div style={{ flex: 1 }} />
            <Button variant="primary" iconLeft={<Ic name="git-merge" size={15} />} disabled={selected.size !== 2} onClick={() => setConfirm({ title: 'Merge series?', msg: 'Combines the two selected series, keeping one as the canonical record. Chapters and progress are merged.', label: 'Merge' })}>Merge</Button>
            <Button variant="ghost" onClick={() => { setSelectMode(false); setSelected(new Set()); }}>Cancel</Button>
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/* ---- Header Tools menu (the UX fix: bulk ops out of the profile menu) ---- */
function ToolsMenu({ onConfirm }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(null);   // key currently running
  const [done, setDone] = React.useState({});     // keys recently completed
  const run = (key) => {
    setBusy(key);
    setTimeout(() => { setBusy(null); setDone(d => ({ ...d, [key]: true })); setTimeout(() => setDone(d => ({ ...d, [key]: false })), 2000); }, 1500);
  };
  const items = [
    { key: 'maintenance', icon: 'wrench', label: 'Run maintenance', hint: 'Page counts, thumbnails, orphans' },
    { key: 'cleanup', icon: 'sparkles', label: 'Cleanup', hint: 'Remove orphaned files & data' },
    { key: 'rescan', icon: 'refresh-cw', label: 'Rescan library', hint: 'Re-detect all files on disk' },
    { key: 'sync', icon: 'rss', label: 'Sync all subscriptions', hint: 'Poll every source for new chapters' },
    { key: 'enrich', icon: 'database', label: 'Re-enrich all', hint: 'Refetch metadata from MyAnimeList', danger: true },
  ];
  return (
    <div style={{ position: 'relative' }}>
      <Button variant="secondary" iconLeft={<Ic name="wrench" size={15} />} iconRight={<Ic name="chevron-down" size={14} />} onClick={() => setOpen(o => !o)}>Tools</Button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
          <div style={{ position: 'absolute', right: 0, top: 44, width: 280, background: 'var(--surface-raised)', border: '1px solid var(--border-default)', borderRadius: 12, boxShadow: 'var(--shadow-2xl)', zIndex: 50, overflow: 'hidden', padding: '4px 0' }}>
            <div className="bindery-kicker" style={{ padding: '8px 14px 4px' }}>Library tools</div>
            {items.map(it => (
              <button key={it.key} onClick={() => run(it.key)} disabled={busy === it.key} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
                onMouseEnter={e => e.currentTarget.style.background = it.danger ? 'rgb(var(--danger)/0.1)' : 'var(--bg-subtle)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ color: done[it.key] ? 'var(--color-success)' : it.danger ? 'var(--color-danger)' : 'var(--text-tertiary)', display: 'inline-flex' }}>
                  {busy === it.key ? <span style={{ display: 'inline-flex', animation: 'by-spin 0.9s linear infinite' }}><Ic name="loader" size={16} /></span> : done[it.key] ? <Ic name="check" size={16} /> : <Ic name={it.icon} size={16} />}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14, color: it.danger ? 'var(--color-danger)' : 'var(--text-body)' }}>{busy === it.key ? 'Running…' : done[it.key] ? 'Done' : it.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{it.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Stat cards ---- */
function StatRow({ tab, subs, users, catalog }) {
  const sets = {
    library: [
      { icon: 'database', label: 'Series', value: A.seriesCount, hint: A.chapterCount + ' chapters' },
      { icon: 'hard-drive', label: 'Storage', value: window.formatBytes(A.librarySize), hint: 'Data: ' + window.formatBytes(A.dataSize) },
      { icon: 'tag', label: 'Tagged', value: '100%', hint: '0 untagged' },
      { icon: 'link', label: 'MAL linked', value: '83%', hint: '2 unlinked' },
    ],
    tasks: [
      { icon: 'loader', label: 'Active', value: window.TASKS.filter(t => t.status === 'downloading').length, accent: 'accent' },
      { icon: 'zap', label: 'Queued', value: window.TASKS.filter(t => t.status === 'queued').length, accent: 'warning' },
      { icon: 'check', label: 'Complete', value: window.TASKS.filter(t => t.status === 'complete').length },
      { icon: 'circle-alert', label: 'Errors', value: window.TASKS.filter(t => t.status === 'error').length, accent: 'danger' },
    ],
    subscriptions: [
      { icon: 'bell', label: 'Subscriptions', value: subs.length },
      { icon: 'database', label: 'New chapters', value: subs.reduce((n, s) => n + s.newChapterCount, 0), accent: 'accent' },
      { icon: 'refresh-cw', label: 'Sources', value: new Set(subs.map(s => s.source)).size },
      { icon: 'zap', label: 'Last sync', value: '2h ago' },
    ],
    users: [
      { icon: 'users', label: 'Users', value: users.length },
      { icon: 'check', label: 'Total reads', value: users.reduce((n, u) => n + u.read, 0) },
      { icon: 'book-open', label: 'Tracking', value: users.reduce((n, u) => n + u.tracked, 0), hint: 'Chapters in progress' },
      { icon: 'zap', label: 'Active readers', value: users.filter(u => u.tracked > 0).length },
    ],
  };
  const accentColor = { accent: 'var(--color-accent)', warning: 'var(--color-warning)', danger: 'var(--color-danger)' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="stat-grid">
      {sets[tab].map((c, i) => (
        <Card key={i} style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 4 }}>
            <Ic name={c.icon} size={12} /> <span>{c.label}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: c.accent && c.value ? accentColor[c.accent] : 'var(--text-body)' }} className="bindery-nums">{c.value}</div>
          {c.hint && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.hint}</div>}
        </Card>
      ))}
    </div>
  );
}

/* ---- Library tab (catalog rows) ---- */
function LibraryTab({ rows, total, selectMode, selected, onToggle, onDelete }) {
  return (
    <div>
      <div className="admin-cols" style={{ display: 'grid', gridTemplateColumns: (selectMode ? '28px ' : '') + 'minmax(0,1fr) 64px minmax(120px,200px) 56px 96px', gap: 12, padding: '0 14px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 500 }}>
        {selectMode && <span></span>}
        <span>Name</span><span style={{ textAlign: 'right' }}>Ch.</span><span>Tags</span><span>MAL</span><span></span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(s => {
          const sel = selected.has(s.id);
          const linked = !!s.en;
          return (
            <div key={s.id} className="admin-cols by-card" style={{
              display: 'grid', gridTemplateColumns: (selectMode ? '28px ' : '') + 'minmax(0,1fr) 64px minmax(120px,200px) 56px 96px',
              gap: 12, alignItems: 'center', padding: '8px 14px', background: 'var(--surface-card)',
              boxShadow: sel ? 'inset 0 0 0 2px var(--color-accent)' : undefined,
            }}>
              {selectMode && (
                <button onClick={() => onToggle(s.id)} aria-label="Select" style={{ width: 20, height: 20, borderRadius: 5, border: '2px solid ' + (sel ? 'var(--color-accent)' : 'var(--border-default)'), background: sel ? 'var(--color-accent)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                  {sel && <Ic name="check" size={13} />}
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <img src={s.cover} alt="" style={{ width: 32, height: 44, borderRadius: 4, objectFit: 'cover', flexShrink: 0, background: 'var(--bg-subtle)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  {s.en && <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.en}</div>}
                </div>
              </div>
              <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }} className="bindery-nums admin-hide">{s.ch}</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', overflow: 'hidden', maxHeight: 22 }} className="admin-hide">
                {s.tags.slice(0, 2).map(t => <span key={t} className="by-tag">{t}</span>)}
              </div>
              <span className="admin-hide" title={linked ? 'Linked to MyAnimeList' : 'No MAL link'} style={{ color: linked ? 'var(--color-success)' : 'var(--text-muted)' }}>
                <Ic name={linked ? 'link' : 'unlink'} size={15} />
              </span>
              <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <IconButton title="Edit metadata" onClick={() => {}}><Ic name="pencil" size={15} /></IconButton>
                <IconButton title="Delete series" variant="destructive" onClick={() => onDelete(s)}><Ic name="trash-2" size={15} /></IconButton>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ padding: '12px 14px 0', fontSize: 11, color: 'var(--text-muted)' }}>{rows.length} of {total}</p>
    </div>
  );
}

/* ---- Tasks tab ---- */
function TasksTab({ tasks }) {
  const tone = { downloading: 'var(--color-accent)', queued: 'var(--color-warning)', complete: 'var(--color-success)', error: 'var(--color-danger)' };
  const icon = { downloading: 'loader', queued: 'zap', complete: 'check', error: 'circle-alert' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map(t => (
        <Card key={t.id} style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: tone[t.status], display: 'inline-flex', flexShrink: 0 }}>
              {t.status === 'downloading' ? <span style={{ display: 'inline-flex', animation: 'by-spin 0.9s linear infinite' }}><Ic name="loader" size={16} /></span> : <Ic name={icon[t.status]} size={16} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)' }}>{t.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }} className="bindery-nums">
                {t.status === 'complete' ? `${t.total} chapters` : t.status === 'error' ? t.error : t.status === 'queued' ? 'Queued' : `Ch. ${t.chapter} — ${t.cur}/${t.total}`}
              </div>
              {(t.status === 'downloading' || t.status === 'queued') && <div style={{ marginTop: 6, maxWidth: 360 }}><ProgressBar value={t.total > 0 ? (t.cur / t.total) * 100 : 0} /></div>}
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {(t.status === 'downloading' || t.status === 'queued') && <IconButton title="Cancel" onClick={() => {}}><Ic name="square" size={14} /></IconButton>}
              {t.status === 'error' && <IconButton title="Retry" onClick={() => {}}><Ic name="rotate-ccw" size={14} /></IconButton>}
              <IconButton title="Delete" variant="destructive" onClick={() => {}}><Ic name="trash-2" size={14} /></IconButton>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---- Subscriptions tab ---- */
function SubsTab({ subs, onUnsub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {subs.map(s => (
        <div key={s.id} className="by-card admin-cols" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(120px,180px) 72px minmax(110px,150px) auto', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--surface-card)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
            {s.en && <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.en}</div>}
          </div>
          <div className="admin-hide" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.source}</div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.mangaId}</div>
          </div>
          <div className="admin-hide" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }} >
            <span className="bindery-nums">{s.chapterCount}</span>
            {s.newChapterCount > 0 && <Badge intent="accent-soft" pill>+{s.newChapterCount}</Badge>}
          </div>
          <span className="admin-hide" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.lastSync || 'Never'}</span>
          <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <IconButton title="Sync now" onClick={() => {}}><Ic name="refresh-cw" size={15} /></IconButton>
            <IconButton title="Unsubscribe" variant="destructive" onClick={() => onUnsub(s)}><Ic name="x" size={15} /></IconButton>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Users tab ---- */
function UsersTab({ users }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="stat-grid">
      {users.map(u => (
        <Card key={u.username} style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar username={u.username} size="lg" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {u.username}
                {u.admin && <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 4, background: 'rgb(var(--accent)/0.15)', color: 'var(--color-accent)', fontWeight: 600 }}>Admin</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }} className="bindery-nums">{u.collection} series · {u.read} read · {u.tracked} tracked</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---- Confirm dialog (replaces window.confirm, portaled-feel modal) ---- */
function ConfirmDialog({ title, msg, label, danger, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgb(0 0 0 / 0.5)', backdropFilter: 'blur(4px)' }} />
      <div role="dialog" aria-modal="true" style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'var(--surface-card)', borderRadius: 12, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-2xl)', padding: 20 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600, color: 'var(--text-body)' }}>{title}</h3>
        {msg && <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{msg}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'destructive' : 'primary'} onClick={onClose}>{label}</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Admin });
