/* Bindery UI kit — Discover (multi-source search). */

const { CoverThumb, Badge, IconButton, Input } = window.DS;

const SOURCES = [
  { id: 'mangadex', name: 'MangaDex', color: '#ff6740' },
  { id: 'mangafox', name: 'MangaFox', color: '#3b82f6' },
  { id: 'rawkuma', name: 'Rawkuma', color: '#e63525' },
  { id: 'readcomics', name: 'ReadComicsOnline', color: '#16a34a' },
  { id: 'archive', name: 'Archive.org', color: '#8b5cf6' },
];

const RESULTS = [
  { t: 'Berserk', y: 1989, src: 0, status: 'ongoing', cover: window.ART.bg2, tags: ['dark fantasy','seinen'], inLib: false },
  { t: 'Oyasumi Punpun', y: 2007, src: 0, status: 'completed', cover: window.ART.forest, tags: ['drama'], inLib: true, inColl: false },
  { t: 'Akira', y: 1982, src: 1, status: 'completed', cover: window.ART.discover, tags: ['sci-fi'], inLib: false },
  { t: 'Monster', y: 1994, src: 0, status: 'completed', cover: window.ART.manga, tags: ['thriller','mystery'], inLib: false },
  { t: 'Kaiju No. 8', y: 2020, src: 2, status: 'ongoing', cover: window.ART.bg3, tags: ['action'], inLib: false },
  { t: 'Slam Dunk', y: 1990, src: 3, status: 'completed', cover: window.ART.bg2, tags: ['sports'], inLib: true, inColl: true },
  { t: 'Nausica\u00e4', y: 1982, src: 4, status: 'completed', cover: window.ART.forest, tags: ['fantasy','adventure'], inLib: false },
  { t: 'Made in Abyss', y: 2012, src: 0, status: 'ongoing', cover: window.ART.manga, tags: ['adventure','horror'], inLib: false },
  { t: 'Real', y: 1999, src: 1, status: 'hiatus', cover: window.ART.discover, tags: ['sports','drama'], inLib: false },
  { t: 'Gantz', y: 2000, src: 2, status: 'completed', cover: window.ART.bg3, tags: ['sci-fi','action'], inLib: false },
];
// Use the real cover art across discover results too.
RESULTS.forEach((r, i) => { r.cover = window.COVERS[i % window.COVERS.length]; });

function Discover() {
  const [q, setQ] = React.useState('');
  const [active, setActive] = React.useState('all');
  const results = RESULTS.filter(r => !q || r.t.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-page)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px 0' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--text-body)' }}>Discover</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-tertiary)' }}>Search across {SOURCES.length} sources, plus your household’s Recommended feed.</p>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 520, marginBottom: 14 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Ic name="search" size={18} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search MangaDex, MangaFox & more…"
            className="by-input" style={{ paddingLeft: 40, height: 44, fontSize: 15 }} />
        </div>

        {/* Source pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <Pill label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ic name="heart" size={13} /> Recommended</span>} active={active === 'all'} onClick={() => setActive('all')} />
          <Pill label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ic name="library" size={13} /> Library</span>} active={active === 'lib'} onClick={() => setActive('lib')} />
          {SOURCES.map((s, i) => (
            <Pill key={s.id} dot={s.color} label={s.name} active={active === s.id} onClick={() => setActive(s.id)} />
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }} className="lib-grid">
          {results.map((r, i) => {
            const src = SOURCES[r.src];
            return (
              <CoverThumb key={i} src={r.cover} title={r.t} topEdgeColor={src.color}
                meta={<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{r.tags.slice(0, 2).map(t => <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--text-tertiary)' }}>{t}</span>)}</div>}
                badgeTR={<Badge intent={statusIntent(r.status)} pill>{r.status}</Badge>}
                badgeTL={r.inLib ? <Badge intent={r.inColl ? 'success' : 'accent'} pill>{r.inColl ? <><Ic name="check" size={9} /> In Collection</> : <><Ic name="library" size={9} /> In Library</>}</Badge> : null}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}

function statusIntent(s) { return s === 'ongoing' ? 'success' : s === 'completed' ? 'accent' : s === 'hiatus' ? 'warning' : 'danger'; }

function Pill({ label, active, dot, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px',
      borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 500,
      border: active ? '1px solid var(--color-accent)' : '1px solid var(--border-default)',
      background: active ? 'rgb(var(--accent)/0.15)' : 'var(--surface-card)',
      color: active ? 'var(--color-accent)' : 'var(--text-secondary)',
    }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
      {label}
    </button>
  );
}

Object.assign(window, { Discover });
