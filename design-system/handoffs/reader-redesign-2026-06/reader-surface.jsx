/* Bindery UI kit — Reader surfaces.
   Since the prototype only has cover art (no interior page scans), each "page"
   is composed from the cover into a paneled, mostly-B&W manga page — different
   panel layout + crops per page index, so flipping, scrubbing and the thumbnail
   rail all show real variety. Exposes three reading interactions to compare:
   PagedTap (tap-zones), PagedSwipe (drag), VerticalScroll (webtoon). */

function rseed(n) { const x = Math.sin(n * 99.13) * 1e4; return x - Math.floor(x); }

// Panel layouts: each = rows of flex-weights. Index picks deterministically.
const PAGE_LAYOUTS = [
  [[1]],
  [[1], [1, 1]],
  [[1, 1], [1]],
  [[1], [1], [1]],
  [[1, 1], [1, 1]],
  [[2, 1], [1, 1, 1]],
  [[1, 2]],
  [[1, 1, 1]],
];

function SpeechBubble({ seed, tail }) {
  const lines = 2 + Math.floor(rseed(seed * 3) * 2);
  return (
    <div style={{ position: 'absolute', left: `${6 + rseed(seed) * 40}%`, top: `${7 + rseed(seed * 2) * 46}%`, maxWidth: '48%', background: '#fff', border: '1.5px solid #111', borderRadius: '46% / 40%', padding: '6px 11px', boxShadow: '1px 2px 0 rgba(0,0,0,0.22)', zIndex: 2 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ height: 3, borderRadius: 2, background: '#222', margin: '3px 0', width: `${55 + rseed(seed + i) * 38}%` }} />
      ))}
      {tail && <div style={{ position: 'absolute', bottom: -7, left: '28%', width: 10, height: 10, background: '#fff', borderRight: '1.5px solid #111', borderBottom: '1.5px solid #111', transform: 'rotate(45deg)' }} />}
    </div>
  );
}

/* A single composed comic page. `page` is 1-based. */
function ComicPage({ src, page, paper = '#efece4' }) {
  const layout = PAGE_LAYOUTS[Math.floor(rseed(page + 1) * PAGE_LAYOUTS.length)];
  let idx = 0;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: paper, padding: '3.4%', display: 'flex', flexDirection: 'column', gap: '2.2%' }}>
      {layout.map((row, ri) => (
        <div key={ri} style={{ flex: 1, display: 'flex', gap: '2.2%', minHeight: 0 }}>
          {row.map((w, ci) => {
            const i = idx++;
            // Bias crops toward the upper-middle, where cover subjects usually
            // sit — avoids landing on dark lower edges and rendering near-black.
            const posX = 18 + Math.floor(rseed(page * 13 + i * 7) * 64);
            const posY = 4 + Math.floor(rseed(page * 5 + i * 3) * 52);
            const hasBubble = rseed(page * 3 + i) > 0.5;
            return (
              <div key={ci} style={{ flex: w, position: 'relative', overflow: 'hidden', background: '#0d0d0d', borderRadius: 1, boxShadow: 'inset 0 0 0 1.5px #111' }}>
                <img src={src} alt="" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${posX}% ${posY}%`, filter: 'grayscale(0.32) contrast(1.04) brightness(1.07)', pointerEvents: 'none' }} />
                {hasBubble && <SpeechBubble seed={page * 9 + i} tail={i % 2 === 0} />}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: '1.6%', right: '3.2%', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#000', opacity: 0.4 }} className="bindery-nums">{page}</div>
    </div>
  );
}

/* Paper-framed page (the fit-mode "card" on dark). */
function PageFrame({ children, anim }) {
  return (
    <div style={{ position: 'relative', height: '94%', aspectRatio: '2 / 3', maxWidth: '96%', borderRadius: 3, overflow: 'hidden', boxShadow: '0 24px 60px rgb(0 0 0 / 0.6)', animation: anim }}>
      {children}
    </div>
  );
}

function EdgeHint({ side, label }) {
  return (
    <div className="reader-edge-hint" style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: '22%', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: side === 'left' ? 'flex-start' : 'flex-end', padding: '0 18px', pointerEvents: 'none', opacity: 0, transition: 'opacity 160ms ease', background: side === 'left' ? 'linear-gradient(to right, rgb(0 0 0 / 0.35), transparent)' : 'linear-gradient(to left, rgb(0 0 0 / 0.35), transparent)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'rgb(0 0 0 / 0.5)', color: '#fff' }}><Ic name={side === 'left' ? 'chevron-left' : 'chevron-right'} size={22} /></span>
    </div>
  );
}

/* ---- 1) Tap-zones (Tachiyomi-style thirds: prev | menu | next) ---- */
function PagedTap({ src, page, total, rtl, dir, onFlip, onToggleChrome, wide }) {
  const onClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.33) onFlip(rtl ? +1 : -1);
    else if (x > 0.67) onFlip(rtl ? -1 : +1);
    else onToggleChrome();
  };
  const slide = dir === 0 ? 'reader-fade 220ms ease' : `reader-slide-${dir > 0 ? 'next' : 'prev'} 240ms cubic-bezier(0.22,0.61,0.36,1)`;
  return (
    <div className="reader-tap" onClick={onClick} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none' }}>
      <PageFrame anim={slide} key={page}><ComicPage src={src} page={page} /></PageFrame>
      <EdgeHint side="left" />
      <EdgeHint side="right" />
    </div>
  );
}

/* ---- 2) Swipe / drag (horizontal track, snaps) ---- */
function PagedSwipe({ src, page, total, rtl, onFlip, onToggleChrome }) {
  const [drag, setDrag] = React.useState(0);
  const [w, setW] = React.useState(1);
  const ref = React.useRef(null);
  const st = React.useRef({ active: false, x0: 0, moved: false });
  React.useEffect(() => { const m = () => setW(ref.current ? ref.current.clientWidth : 1); m(); window.addEventListener('resize', m); return () => window.removeEventListener('resize', m); }, []);
  const sign = rtl ? -1 : 1;

  const down = (x) => { st.current = { active: true, x0: x, moved: false }; };
  const move = (x) => { if (!st.current.active) return; const dx = x - st.current.x0; if (Math.abs(dx) > 6) st.current.moved = true; setDrag(dx); };
  const up = () => {
    if (!st.current.active) return;
    const dx = drag; st.current.active = false;
    const threshold = w * 0.18;
    if (dx <= -threshold) onFlip(sign * +1);
    else if (dx >= threshold) onFlip(sign * -1);
    else if (!st.current.moved) onToggleChrome();
    setDrag(0);
  };

  // window of pages to render: prev, current, next
  const idxs = [page - 1, page, page + 1].filter(p => p >= 1 && p <= total);
  return (
    <div ref={ref}
      onMouseDown={e => down(e.clientX)} onMouseMove={e => move(e.clientX)} onMouseUp={up} onMouseLeave={() => st.current.active && up()}
      onTouchStart={e => down(e.touches[0].clientX)} onTouchMove={e => move(e.touches[0].clientX)} onTouchEnd={up}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor: st.current.active ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'pan-y' }}>
      {idxs.map(p => {
        const offset = (p - page) * w + drag;
        return (
          <div key={p} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translateX(${offset}px)`, transition: st.current.active ? 'none' : 'transform 240ms cubic-bezier(0.22,0.61,0.36,1)', willChange: 'transform' }}>
            <PageFrame><ComicPage src={src} page={p} /></PageFrame>
          </div>
        );
      })}
    </div>
  );
}

/* ---- 3) Vertical scroll (webtoon) ---- */
const VerticalScroll = React.forwardRef(function VerticalScroll({ src, page, total, onPageChange, onToggleChrome }, ref) {
  const scrollRef = React.useRef(null);
  const pageEls = React.useRef([]);
  const programmatic = React.useRef(false);

  React.useImperativeHandle(ref, () => ({
    scrollToPage(p) {
      const el = pageEls.current[p - 1];
      if (el && scrollRef.current) { programmatic.current = true; scrollRef.current.scrollTo({ top: el.offsetTop - 12, behavior: 'auto' }); setTimeout(() => { programmatic.current = false; }, 60); }
    },
  }), []);

  // On entering scroll mode, land on the page the reader was already on.
  const initialPage = React.useRef(page);
  React.useEffect(() => {
    const el = pageEls.current[initialPage.current - 1];
    if (el && scrollRef.current) { programmatic.current = true; scrollRef.current.scrollTop = Math.max(0, el.offsetTop - 12); setTimeout(() => { programmatic.current = false; }, 80); }
  }, []);

  const onScroll = () => {
    if (programmatic.current) return;
    const sc = scrollRef.current; if (!sc) return;
    const mid = sc.scrollTop + sc.clientHeight / 2;
    let best = 1, bestD = Infinity;
    pageEls.current.forEach((el, i) => { if (!el) return; const c = el.offsetTop + el.clientHeight / 2; const d = Math.abs(c - mid); if (d < bestD) { bestD = d; best = i + 1; } });
    if (best !== page) onPageChange(best);
  };

  return (
    <div ref={scrollRef} onScroll={onScroll} onClick={onToggleChrome} className="no-scrollbar"
      style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer', scrollBehavior: 'smooth' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} ref={el => pageEls.current[i] = el} style={{ width: 'min(720px, 92%)', aspectRatio: '2 / 3', borderRadius: 3, overflow: 'hidden', boxShadow: '0 8px 30px rgb(0 0 0 / 0.5)', flexShrink: 0 }}>
          <ComicPage src={src} page={i + 1} />
        </div>
      ))}
    </div>
  );
});

Object.assign(window, { ComicPage, PageFrame, PagedTap, PagedSwipe, VerticalScroll, EdgeHint });
