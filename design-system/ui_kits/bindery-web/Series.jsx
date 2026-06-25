/* Bindery UI kit — Series detail page (immersive cover hero + rich states). */

const { Button, IconButton, Badge, StatusPill, Tag, CoverThumb, Avatar, ProgressBar, SegmentedControl, Kicker } = window.DS;

function Series({ series, onBack, onOpenChapter, onOpenMenu }) {
  const chs = window.chapters(series);
  const [fav, setFav] = React.useState(false);
  const [pinned, setPinned] = React.useState(!!series.pinned);
  const [view, setView] = React.useState('list');
  const [save, setSave] = React.useState(series.savedOffline ? 'saved' : 'idle'); // idle | saving | saved

  const pct = series.ch > 0 ? Math.round((series.read / series.ch) * 100) : 0;
  const favCount = (series.favoritedBy ? series.favoritedBy.length : 0) + (fav ? 1 : 0);
  const continueN = series.read > 0 && series.read < series.ch ? series.read + 1 : 1;
  const startLabel = series.read >= series.ch ? 'Re-read' : series.read > 0 ? 'Continue reading' : 'Start reading';

  const doSave = () => {
    if (save === 'saved') { setSave('idle'); return; }
    setSave('saving');
    setTimeout(() => setSave('saved'), 1400);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-page)' }}>
      {/* ===== Cover-as-hero ===== */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', height: 300 }}>
          <img src={series.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(30px) brightness(0.45)', transform: 'scale(1.15)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgb(0 0 0 / 0.25) 0%, rgb(0 0 0 / 0.45) 50%, var(--bg-page) 100%)' }} />
        </div>

        <button onClick={onBack} title="Back" aria-label="Back" style={floatBtn('left')}><Ic name="arrow-left" size={20} /></button>
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 40, display: 'flex', gap: 8 }}>
          <button onClick={onOpenMenu} title="Profile" aria-label="Profile" style={{ ...floatBtn(), position: 'static', padding: 6 }}>
            <Avatar username="Jammo" size="md" variant="onDark" />
          </button>
        </div>

        <div style={{ position: 'relative', maxWidth: 1024, margin: '0 auto', padding: '56px 24px 0', display: 'flex', gap: 24 }}>
          <img src={series.cover} alt={series.name}
            style={{ width: 188, aspectRatio: '2/3', objectFit: 'cover', borderRadius: 12, boxShadow: 'var(--shadow-2xl)', flexShrink: 0, alignSelf: 'flex-start' }} />

          <div style={{ paddingTop: 30, color: '#fff', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <StatusPill status={series.status} />
              {series.score > 0 && <Stat icon="star" tone="#fde68a">{series.score.toFixed(1)}</Stat>}
              {favCount > 0 && <Stat icon="heart" tone="#fca5a5">{favCount}</Stat>}
              {series.savedOffline && <Stat icon="download" tone="#86efac">Offline</Stat>}
            </div>

            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, lineHeight: 1.08, textShadow: '0 2px 10px rgb(0 0 0 / 0.5)' }}>{series.name}</h1>
            {series.en && <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>{series.en}</div>}

            {/* Meta + reading progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 13, opacity: 0.9 }} className="bindery-nums">
              <span>{series.year}</span><span style={{ opacity: 0.4 }}>·</span>
              <span>{series.ch} chapters</span><span style={{ opacity: 0.4 }}>·</span>
              <span>{series.read}/{series.ch} read</span>
            </div>
            <div style={{ maxWidth: 320, marginTop: 8 }}>
              <div style={{ height: 6, background: 'rgb(255 255 255 / 0.2)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: 'rgb(var(--accent))', borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }} className="bindery-nums">{pct}% complete</div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {series.tags.map(t => <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgb(255 255 255 / 0.18)', backdropFilter: 'blur(4px)', textTransform: 'capitalize' }}>{t}</span>)}
            </div>

            {series.source && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 12, opacity: 0.8 }}>
                <Ic name="refresh-cw" size={13} /> Synced from {series.source}<span style={{ opacity: 0.5 }}>· {series.lastSync}</span>
                {series.neww > 0 && <Badge intent="new">+{series.neww} New</Badge>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Body ===== */}
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '20px 24px 48px' }}>
        {/* Action row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <Button variant="primary" size="lg" iconLeft={<Ic name="book-open" size={18} />} onClick={() => onOpenChapter(series, continueN)}>{startLabel}</Button>
          <Button variant={fav ? 'primary' : 'secondary'} size="lg" iconLeft={<Ic name="heart" size={18} />} onClick={() => setFav(f => !f)}>{fav ? 'Recommended' : 'Recommend'}</Button>
          {save === 'saving' ? (
            <Button variant="secondary" size="lg" iconLeft={<span style={{ display: 'inline-flex', animation: 'by-spin 0.9s linear infinite' }}><Ic name="loader" size={18} /></span>}>Saving…</Button>
          ) : (
            <Button variant={save === 'saved' ? 'primary' : 'secondary'} size="lg" iconLeft={<Ic name={save === 'saved' ? 'check' : 'download'} size={18} />} onClick={doSave}>{save === 'saved' ? 'Saved offline' : 'Save offline'}</Button>
          )}
          <IconButton title={pinned ? 'Unpin' : 'Pin to currently reading'} active={pinned} onClick={() => setPinned(p => !p)}><Ic name="pin" size={18} /></IconButton>
          <IconButton title="More" onClick={onOpenMenu}><Ic name="ellipsis" size={18} /></IconButton>
        </div>

        {/* Recommended-by attribution */}
        {series.favoritedBy && series.favoritedBy.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '8px 12px', background: 'rgb(var(--accent)/0.10)', borderRadius: 10, width: 'fit-content' }}>
            <div style={{ display: 'flex' }}>
              {series.favoritedBy.map((u, i) => (
                <span key={u} style={{ marginLeft: i ? -8 : 0, boxShadow: '0 0 0 2px var(--bg-page)', borderRadius: '50%' }}><Avatar username={u} size="sm" /></span>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Recommended by <strong style={{ color: 'var(--text-body)' }}>{series.favoritedBy.join(', ')}</strong></span>
          </div>
        )}

        <p style={{ maxWidth: 720, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 28 }}>{series.synopsis}</p>

        {/* Chapters header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Kicker count={series.ch}>Chapters</Kicker>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }} className="bindery-nums">{series.read} read · {series.ch - series.read} left</span>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" iconLeft={<Ic name="check-check" size={15} />}>Mark all read</Button>
          <SegmentedControl
            options={[{ value: 'list', label: '', icon: <Ic name="list" size={15} /> }, { value: 'grid', label: '', icon: <Ic name="layout-grid" size={15} /> }]}
            value={view} onChange={setView} />
        </div>

        {view === 'grid' ? <ChapterGrid series={series} chs={chs} onOpen={onOpenChapter} /> : <ChapterList series={series} chs={chs} onOpen={onOpenChapter} />}
      </div>
    </div>
  );
}

/* ---- Chapter grid (cover thumbnails with state badges) ---- */
function ChapterGrid({ series, chs, onOpen }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }} className="lib-grid">
      {chs.map(c => (
        <CoverThumb key={c.n} src={series.cover} title={c.file}
          meta={<span className="bindery-nums">{c.pages} pages</span>}
          onClick={() => onOpen(series, c.n)}
          read={c.read} progress={c.inProg ? c.progress : null}
          badgeTL={c.downloaded ? <span title="Saved offline" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: 'rgb(var(--success)/0.95)', color: '#fff' }}><Ic name="download" size={10} /></span> : null}
          badgeTR={
            c.partial ? <Badge intent="warning" pill><Ic name="triangle-alert" size={9} /> {c.partial.ok}/{c.partial.total}</Badge>
            : c.read ? <Badge intent="success" pill><Ic name="check" size={9} /> Read</Badge>
            : c.inProg ? <Badge intent="accent" pill>p.{c.page}</Badge>
            : c.isNew ? <Badge intent="new">New</Badge>
            : null
          }
        />
      ))}
    </div>
  );
}

/* ---- Chapter list (dense rows that spell out every state) ---- */
function ChapterList({ series, chs, onOpen }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {chs.map(c => {
        const state = c.partial ? 'partial' : c.read ? 'read' : c.inProg ? 'inprog' : c.isNew ? 'new' : 'unread';
        const numBg = c.read ? 'rgb(var(--success)/0.15)' : c.inProg ? 'rgb(var(--accent)/0.15)' : 'var(--bg-subtle)';
        const numColor = c.read ? 'var(--color-success)' : c.inProg ? 'var(--color-accent)' : 'var(--text-tertiary)';
        return (
          <button key={c.n} onClick={() => onOpen(series, c.n)} className="by-card by-card--interactive"
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', textAlign: 'left', background: 'var(--surface-card)' }}>
            {/* number / read marker */}
            <span style={{ width: 34, height: 34, borderRadius: 8, background: numBg, color: numColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 600, fontSize: 13 }} className="bindery-nums">
              {c.read ? <Ic name="check" size={16} /> : c.n}
            </span>
            {/* title + sub */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-body)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {c.file}
                {c.downloaded && <span title="Saved offline" style={{ color: 'var(--color-success)', display: 'inline-flex' }}><Ic name="download" size={13} /></span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }} className="bindery-nums">
                {c.pages} pages{c.inProg ? ` · on page ${c.page}` : ''}{c.partial ? ` · ${c.partial.ok} of ${c.partial.total} downloaded` : ''}
              </div>
              {c.inProg && <div style={{ marginTop: 6, maxWidth: 220 }}><ProgressBar value={c.progress} /></div>}
            </div>
            {/* state badge */}
            <div style={{ flexShrink: 0 }}>
              {state === 'partial' && <Badge intent="warning" pill><Ic name="triangle-alert" size={10} /> Partial</Badge>}
              {state === 'read' && <Badge intent="success" pill>Read</Badge>}
              {state === 'inprog' && <Badge intent="accent" pill>Reading · p.{c.page}</Badge>}
              {state === 'new' && <Badge intent="new">New</Badge>}
              {state === 'unread' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unread</span>}
            </div>
            <Ic name="chevron-right" size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        );
      })}
    </div>
  );
}

function Stat({ icon, tone, children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: tone }}><Ic name={icon} size={13} style={{ color: tone }} /> {children}</span>;
}

function floatBtn(side) {
  return {
    position: side ? 'absolute' : 'static', top: 16, [side || '_']: 16, zIndex: 40,
    padding: 10, borderRadius: '50%', background: 'rgb(0 0 0 / 0.4)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    color: '#fff', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-lg)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}

Object.assign(window, { Series });
