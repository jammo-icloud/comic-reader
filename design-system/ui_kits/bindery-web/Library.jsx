/* Bindery UI kit — Library page. */

const { CoverThumb, Badge, SegmentedControl, IconButton, Kicker, ProgressBar } = window.DS;

function ContinueShelf({ onOpen }) {
  return (
    <section>
      <Kicker count={window.CONTINUE.length}>Continue reading</Kicker>
      <div className="no-scrollbar" style={{ overflowX: 'auto', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
          {window.CONTINUE.map((it, i) => (
            <button key={i} onClick={() => onOpen(it.s, it.ch)} style={{
              flex: '0 0 auto', width: 220, display: 'flex', alignItems: 'center', gap: 12, padding: 8,
              borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--border-default)',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ position: 'relative', width: 40, height: 56, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-subtle)', flexShrink: 0 }}>
                <img src={it.s.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 5 }}>Chapter {it.ch}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ProgressBar value={(it.page / it.pages) * 100} />
                  <span className="bindery-nums" style={{ fontSize: 10, color: 'var(--text-muted)' }}>p.{it.page}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Library({ onOpenSeries, onOpenChapter }) {
  const [type, setType] = React.useState('Comics');
  const [search, setSearch] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const list = window.SERIES.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-page)' }}>
      {/* Sticky toolbar under the header */}
      <div style={{
        position: 'sticky', top: 48, zIndex: 20, background: 'var(--chrome-bg)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <SegmentedControl options={['Comics', 'Magazines']} value={type} onChange={setType} />
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }} className="bindery-nums">{list.length} series</span>
          <div style={{ flex: 1 }} />
          {showSearch && (
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="by-input" style={{ width: 200, height: 36 }} />
          )}
          <IconButton title="Search" active={showSearch} onClick={() => setShowSearch(s => !s)}><Ic name="search" /></IconButton>
          <IconButton title="Tags" onClick={() => {}}><Ic name="tag" /></IconButton>
          <IconButton title="Sort" label="Name" onClick={() => {}}><Ic name="arrow-down-a-z" /></IconButton>
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {!search && <ContinueShelf onOpen={onOpenChapter} />}
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }} className="lib-grid">
            {list.map(s => {
              const nsfw = (s.tags || []).some(t => ['nsfw','adult','hentai','ecchi'].includes(t));
              const meta = (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{s.ch} ch.</span>
                  <span className="bindery-nums">{s.read}/{s.ch}</span>
                  {s.score > 0 && <span style={{ marginLeft: 'auto', color: 'var(--color-warning)' }}>{s.score.toFixed(1)}</span>}
                </div>
              );
              return (
                <CoverThumb key={s.id} src={s.cover} title={s.name}
                  onClick={() => onOpenSeries(s)}
                  blurred={nsfw}
                  meta={meta}
                  badgeTL={s.saved ? <Badge intent="success" pill><Ic name="download" size={9} /> Saved</Badge> : null}
                  badgeTR={nsfw ? <Badge intent="danger" pill>NSFW</Badge> : (s.neww ? <Badge intent="new">+{s.neww} New</Badge> : null)}
                  badgeBL={s.pinned ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgb(var(--accent)/0.9)', color: '#fff' }}><Ic name="pin" size={11} /></span> : null}
                  progress={s.read > 0 && s.read < s.ch ? Math.round((s.read / s.ch) * 100) : null}
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

Object.assign(window, { Library });
