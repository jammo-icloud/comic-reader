/* Bindery UI kit — Reader side panels: ChapterRail (desktop thumbnails +
   chapter list; a slide-in drawer on mobile) and StoryPanel (narration). */

const { Badge: _RBadge, StatusPill: _RStatus } = window.DS;

/* ---- Thumbnail + chapter rail ---- */
function ChapterRail({ series, chapters, chapter, page, total, onJumpPage, onPickChapter, onClose, drawer }) {
  const [tab, setTab] = React.useState('pages'); // pages | chapters

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#121110', color: '#fff', borderRight: drawer ? 'none' : '1px solid rgb(255 255 255 / 0.08)' }}>
      {/* Series header */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', gap: 12, alignItems: 'flex-start', borderBottom: '1px solid rgb(255 255 255 / 0.08)' }}>
        <img src={series.cover} alt="" style={{ width: 44, height: 62, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{series.name}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>Chapter {chapter}{series.en ? ' · ' + series.en : ''}</div>
        </div>
        {drawer && <button onClick={onClose} aria-label="Close" style={railIconBtn}><Ic name="x" size={18} /></button>}
      </div>

      {/* Tab switch */}
      <div style={{ display: 'flex', padding: '8px 12px 0', gap: 4 }}>
        {['pages', 'chapters'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, textTransform: 'capitalize', borderRadius: 7, cursor: 'pointer', border: 'none', background: tab === t ? 'rgb(255 255 255 / 0.12)' : 'transparent', color: tab === t ? '#fff' : 'rgb(255 255 255 / 0.55)' }}>{t}</button>
        ))}
      </div>

      {tab === 'pages' ? (
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, alignContent: 'start' }}>
          {Array.from({ length: total }).map((_, i) => {
            const n = i + 1, cur = n === page;
            return (
              <button key={n} onClick={() => onJumpPage(n)} style={{ position: 'relative', padding: 0, border: cur ? '2px solid rgb(var(--accent))' : '2px solid transparent', borderRadius: 5, overflow: 'hidden', cursor: 'pointer', background: 'none', aspectRatio: '2/3' }}>
                <div style={{ width: '100%', height: '100%', opacity: n <= page ? 1 : 0.5 }}><ComicPage src={series.cover} page={n} /></div>
                <span style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#fff', background: 'rgb(0 0 0 / 0.6)', padding: '0 4px', borderRadius: 3 }}>{n}</span>
                {n < page && <span style={{ position: 'absolute', top: 3, left: 3, width: 14, height: 14, borderRadius: '50%', background: 'rgb(var(--success))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic name="check" size={9} /></span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {chapters.map(c => {
            const cur = c.n === chapter;
            return (
              <button key={c.n} onClick={() => onPickChapter(c.n)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', border: 'none', textAlign: 'left', background: cur ? 'rgb(var(--accent)/0.18)' : 'transparent', color: '#fff', marginBottom: 2 }}>
                <span style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: c.read ? 'rgb(var(--success)/0.2)' : 'rgb(255 255 255 / 0.08)', color: c.read ? 'rgb(var(--success))' : 'rgb(255 255 255 / 0.6)' }} className="bindery-nums">{c.read ? <Ic name="check" size={14} /> : c.n}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: cur ? 600 : 400 }}>Chapter {c.n}</span>
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.5 }} className="bindery-nums">{c.pages} pages</span>
                </span>
                {c.inProg && <_RBadge intent="accent" pill>Reading</_RBadge>}
                {c.isNew && !c.inProg && <_RBadge intent="new">New</_RBadge>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!drawer) return body;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgb(0 0 0 / 0.5)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 'min(320px, 84vw)', boxShadow: 'var(--shadow-2xl)', animation: 'reader-drawer-in 240ms cubic-bezier(0.22,0.61,0.36,1)' }}>{body}</div>
    </div>
  );
}

/* ---- Story mode narration panel ---- */
function StoryPanel({ series, page, ambient, wide, onClose }) {
  // Deterministic fake narration per page.
  const lines = STORY_LINES(series, page);
  const bubbles = 2 + (page % 3);
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', background: '#0e0d0c', color: '#fff', borderLeft: wide ? '1px solid rgb(255 255 255 / 0.1)' : 'none', borderTop: wide ? 'none' : '1px solid rgb(255 255 255 / 0.1)', overflow: 'hidden' }}>
      {/* ambient backdrop */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${series.cover})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(40px) brightness(0.4) saturate(1.2)', opacity: 0.5, transform: 'scale(1.2)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgb(255 255 255 / 0.08)' }}>
          <span style={{ display: 'inline-flex', color: 'rgb(var(--accent))' }}><Ic name="book-open" size={16} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Story · Page {page}</span>
          <button aria-label="Read aloud" title="Read aloud" style={railIconBtn}><Ic name="volume-2" size={16} /></button>
          <button onClick={onClose} aria-label="Close Story mode" title="Exit Story mode" style={railIconBtn}><Ic name="x" size={16} /></button>
        </div>
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgb(255 255 255 / 0.92)', margin: '0 0 20px', fontFamily: 'var(--font-serif, Georgia, serif)' }}>{lines.narration}</p>
          <div className="bindery-kicker" style={{ color: 'rgb(255 255 255 / 0.45)', marginBottom: 10 }}>Bubbles on this page</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: bubbles }).map((_, i) => (
              <button key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid rgb(255 255 255 / 0.1)', background: 'rgb(255 255 255 / 0.04)', color: '#fff', cursor: 'pointer' }}>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgb(var(--accent))', marginTop: 2 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>{lines.bubbles[i % lines.bubbles.length]}</span>
                <span style={{ display: 'inline-flex', opacity: 0.4 }}><Ic name="crosshair" size={14} /></span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgb(255 255 255 / 0.08)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, opacity: 0.5 }}>
          <Ic name="sparkles" size={13} /> AI narration · tap a bubble to find it on the page
        </div>
      </div>
    </div>
  );
}

function STORY_LINES(series, page) {
  const narrs = [
    `The panel opens wide and quiet. ${series.name} holds the moment before the turn — a breath drawn in, the city below indifferent to what is about to happen.`,
    `A closer beat now. The line work tightens around the eyes; whatever was said a page ago is landing, and it isn't landing softly.`,
    `Motion erupts across the gutter. The art lets the action spill panel-to-panel, and for a moment the page forgets it is paper.`,
    `Stillness again, earned this time. The two figures don't speak. The space between them does the talking.`,
  ];
  const bubbles = ['"You came back."', '"I told you I would."', '"…then it\u2019s already too late."', '"Hold the line. Whatever it costs."', '(a long, deliberate silence)'];
  return { narration: narrs[page % narrs.length], bubbles };
}

const railIconBtn = { background: 'rgb(255 255 255 / 0.08)', border: 'none', color: '#fff', cursor: 'pointer', width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

Object.assign(window, { ChapterRail, StoryPanel });
