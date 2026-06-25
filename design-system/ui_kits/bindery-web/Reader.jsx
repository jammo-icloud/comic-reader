/* Bindery UI kit — immersive Reader. Always dark, theme-independent chrome. */

function Reader({ series, chapter, onBack }) {
  const total = 18 + ((chapter * 7) % 14);
  const [page, setPage] = React.useState(8);
  const [chromeOn, setChromeOn] = React.useState(true);
  const pct = ((page) / total) * 100;
  const go = (d) => setPage(p => Math.max(1, Math.min(total, p + d)));

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Floating back */}
      <button onClick={onBack} title="Back" aria-label="Back" style={{
        position: 'absolute', top: 16, left: 16, zIndex: 40, padding: 10, borderRadius: '50%',
        background: 'rgb(0 0 0 / 0.5)', backdropFilter: 'blur(12px)', color: '#fff', border: 'none', cursor: 'pointer',
        boxShadow: 'var(--shadow-lg)', display: 'inline-flex',
      }}><Ic name="arrow-left" size={20} /></button>

      {/* Page surface */}
      <div onClick={() => setChromeOn(c => !c)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
        <div style={{ position: 'relative', height: '88%', aspectRatio: '2/3', maxWidth: '94%', background: '#15110d', borderRadius: 2, overflow: 'hidden', boxShadow: '0 20px 60px rgb(0 0 0 / 0.6)' }}>
          <img src={series.cover} alt={`Page ${page}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.15) contrast(1.05)' }} />
          <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#fff', background: 'rgb(0 0 0 / 0.55)', padding: '2px 8px', borderRadius: 4 }}>{page} / {total}</div>
        </div>
        {/* tap zones hint */}
        {chromeOn && (
          <>
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} title="Previous page" aria-label="Previous page" style={edgeNav('left')}><Ic name="chevron-left" size={28} /></button>
            <button onClick={(e) => { e.stopPropagation(); go(1); }} title="Next page" aria-label="Next page" style={edgeNav('right')}><Ic name="chevron-right" size={28} /></button>
          </>
        )}
      </div>

      {/* Bottom toolbar */}
      <div style={{
        transform: chromeOn ? 'translateY(0)' : 'translateY(110%)', transition: 'transform 250ms var(--ease)',
        background: 'rgb(0 0 0 / 0.9)', backdropFilter: 'blur(12px)', padding: '12px 18px 18px', color: '#fff',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center', marginBottom: 8 }}>{series.name} · Chapter {chapter}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => go(-1)} title="Previous" aria-label="Previous" style={readerBtn}><Ic name="chevron-left" size={20} /></button>
            <input type="range" min="1" max={total} value={page} onChange={e => setPage(+e.target.value)}
              style={{ flex: 1, accentColor: 'rgb(var(--accent))' }} />
            <span className="bindery-nums" style={{ fontSize: 13, minWidth: 54, textAlign: 'center' }}>{page} / {total}</span>
            <button onClick={() => go(1)} title="Next" aria-label="Next" style={readerBtn}><Ic name="chevron-right" size={20} /></button>
            <button title="Fit mode" aria-label="Fit mode" style={readerBtn}><Ic name="maximize" size={18} /></button>
            <button title="Translate" aria-label="Translate" style={readerBtn}><Ic name="languages" size={18} /></button>
          </div>
          <div style={{ height: 3, background: 'rgb(255 255 255 / 0.15)', borderRadius: 2, marginTop: 12 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'rgb(var(--accent))', borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const readerBtn = {
  background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
  padding: 8, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
function edgeNav(side) {
  return {
    position: 'absolute', top: '50%', [side]: 18, transform: 'translateY(-50%)', zIndex: 30,
    background: 'rgb(0 0 0 / 0.4)', backdropFilter: 'blur(8px)', color: '#fff', border: 'none',
    width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}

Object.assign(window, { Reader });
