/* Bindery UI kit — Reader. Theme-independent dark chrome.
   Desktop: single page centered + thumbnail/chapter rail down the side.
   Mobile: immersive, auto-hiding name bar, rail as a drawer.
   Reading interaction is switchable live to compare: Tap · Swipe · Scroll.
   Story mode designed in: right rail (wide) / bottom strip (narrow). */

const { Button: _RBtn, IconButton: _RIcBtn, SegmentedControl: _RSeg } = window.DS;

const RAIL_W = 304, STORY_W = 384, STORY_BOTTOM = '42dvh';

function Reader({ series, chapter, onBack }) {
  const chs = React.useMemo(() => window.chapters(series), [series]);
  const [ch, setCh] = React.useState(chapter);
  const cur = chs.find(c => c.n === ch) || chs[0];
  const idx = chs.indexOf(cur);
  const prevCh = idx > 0 ? chs[idx - 1] : null;
  const nextCh = idx < chs.length - 1 ? chs[idx + 1] : null;
  const total = cur.pages;

  // reading direction from tags (manga reads right-to-left)
  const rtlAuto = (series.tags || []).some(t => ['manga', 'shounen', 'seinen', 'japanese', 'isekai'].includes(t));
  const [rtl, setRtl] = React.useState(rtlAuto);

  // mode persists across chapters; page persists per (series, chapter)
  const modeKey = 'bindery.reader.mode';
  const [mode, setMode] = React.useState(() => localStorage.getItem(modeKey) || 'tap');
  React.useEffect(() => { try { localStorage.setItem(modeKey, mode); } catch (e) {} }, [mode]);

  const pageKey = `bindery.reader.${series.id}.${ch}.page`;
  const [page, setPage] = React.useState(() => { const v = +localStorage.getItem(pageKey); return v >= 1 && v <= total ? v : Math.min(cur.page || 1, total) || 1; });
  const [dir, setDir] = React.useState(0);
  React.useEffect(() => { try { localStorage.setItem(pageKey, page); } catch (e) {} }, [page, pageKey]);

  const [wide, setWide] = React.useState(() => window.matchMedia('(min-width: 900px)').matches);
  React.useEffect(() => { const mq = window.matchMedia('(min-width: 900px)'); const h = e => setWide(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);

  const [chromeOn, setChromeOn] = React.useState(true);
  const [railOpen, setRailOpen] = React.useState(true);   // desktop rail
  const [drawer, setDrawer] = React.useState(false);      // mobile rail drawer
  const [storyOn, setStoryOn] = React.useState(false);
  const vsRef = React.useRef(null);
  const hideTimer = React.useRef(null);

  // auto-hide chrome after inactivity; any pointer move / key reveals it
  const poke = React.useCallback(() => {
    setChromeOn(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeOn(false), 3200);
  }, []);
  React.useEffect(() => { poke(); return () => clearTimeout(hideTimer.current); }, [poke, page, ch, mode]);

  const pickChapter = (n) => { setCh(n); setDir(0); const c = chs.find(x => x.n === n); const v = +localStorage.getItem(`bindery.reader.${series.id}.${n}.page`); setPage(v >= 1 ? v : 1); setDrawer(false); };

  const go = React.useCallback((delta) => {
    setDir(delta);
    const target = page + delta;
    if (target < 1) { if (prevCh) pickChapter2(prevCh.n, prevCh.pages); return; }
    if (target > total) { if (nextCh) pickChapter2(nextCh.n, 1); return; }
    setPage(target);
    if (mode === 'scroll' && vsRef.current) vsRef.current.scrollToPage(target);
  }, [page, total, mode, prevCh, nextCh]);

  function pickChapter2(n, landPage) { setCh(n); setDir(0); setPage(landPage); if (mode === 'scroll' && vsRef.current) setTimeout(() => vsRef.current && vsRef.current.scrollToPage(landPage), 30); }

  const seek = (n) => { setDir(0); setPage(n); if (mode === 'scroll' && vsRef.current) vsRef.current.scrollToPage(n); };

  // keyboard
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') { onBack(); return; }
      poke();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(rtl ? -1 : +1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(rtl ? +1 : -1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, rtl, poke, onBack]);

  const src = series.cover;
  const showStorySide = storyOn && wide;
  const showStoryStrip = storyOn && !wide;

  // ---- reading surface ----
  let surface;
  if (mode === 'scroll') surface = <VerticalScroll ref={vsRef} src={src} page={page} total={total} onPageChange={setPage} onToggleChrome={() => setChromeOn(c => !c)} />;
  else if (mode === 'swipe') surface = <div style={{ position: 'absolute', inset: 0 }}><PagedSwipe src={src} page={page} total={total} rtl={rtl} onFlip={go} onToggleChrome={() => setChromeOn(c => !c)} /></div>;
  else surface = <div style={{ position: 'absolute', inset: 0 }}><PagedTap src={src} page={page} total={total} rtl={rtl} dir={dir} onFlip={go} onToggleChrome={() => setChromeOn(c => !c)} wide={wide} /></div>;

  const bottomOffset = showStoryStrip ? STORY_BOTTOM : '0px';

  return (
    <div onMouseMove={wide ? poke : undefined} style={{ position: 'fixed', inset: 0, background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
        {/* desktop rail */}
        {wide && railOpen && (
          <div style={{ width: RAIL_W, flexShrink: 0, height: '100%' }}>
            <ChapterRail series={series} chapters={chs} chapter={ch} page={page} total={total} onJumpPage={seek} onPickChapter={pickChapter} />
          </div>
        )}

        {/* center reading surface */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {surface}

          {/* desktop discoverable side arrows (paged modes) */}
          {wide && mode !== 'scroll' && chromeOn && (
            <>
              <button onClick={() => go(rtl ? +1 : -1)} aria-label={rtl ? 'Next page' : 'Previous page'} style={sideArrow('left')}><Ic name="chevron-left" size={26} /></button>
              <button onClick={() => go(rtl ? -1 : +1)} aria-label={rtl ? 'Previous page' : 'Next page'} style={sideArrow('right')}><Ic name="chevron-right" size={26} /></button>
            </>
          )}
        </div>

        {/* story side rail (wide) */}
        {showStorySide && (
          <div style={{ width: STORY_W, flexShrink: 0, height: '100%' }}>
            <StoryPanel series={series} page={page} wide onClose={() => setStoryOn(false)} />
          </div>
        )}
      </div>

      {/* story bottom strip (narrow) */}
      {showStoryStrip && (
        <div style={{ height: STORY_BOTTOM, flexShrink: 0 }}>
          <StoryPanel series={series} page={page} wide={false} onClose={() => setStoryOn(false)} />
        </div>
      )}

      {/* ===== Top bar (auto-hide) ===== */}
      <div style={{ position: 'absolute', top: 0, left: wide && railOpen ? RAIL_W : 0, right: showStorySide ? STORY_W : 0, zIndex: 40, transform: chromeOn ? 'translateY(0)' : 'translateY(-110%)', transition: 'transform 240ms var(--ease, ease)', background: 'linear-gradient(to bottom, rgb(0 0 0 / 0.85), rgb(0 0 0 / 0))', padding: '10px 12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} title={series.name} aria-label="Back to series" style={chromeBtn}><Ic name="arrow-left" size={20} /></button>
          <button onClick={() => (wide ? setRailOpen(r => !r) : setDrawer(true))} title="Chapters & pages" aria-label="Chapters and pages" style={chromeBtn}><Ic name="panel-left" size={18} /></button>
          <div style={{ minWidth: 0, flex: 1 }}>
            {!(wide && railOpen) && <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{series.name}</div>}
            <div style={{ fontSize: 12, opacity: 0.7 }} className="bindery-nums">Chapter {ch} · Page {page} / {total}</div>
          </div>
          {/* On wide screens the controls fit on one row */}
          {wide && (
            <_RSeg
              options={[
                { value: 'tap', label: 'Tap', icon: <Ic name="pointer" size={15} /> },
                { value: 'swipe', label: 'Swipe', icon: <Ic name="move-horizontal" size={15} /> },
                { value: 'scroll', label: 'Scroll', icon: <Ic name="gallery-vertical" size={15} /> },
              ]}
              value={mode} onChange={setMode} className="reader-seg" />
          )}
          {wide && <button onClick={() => setRtl(r => !r)} title={rtl ? 'Right-to-left (manga)' : 'Left-to-right'} aria-label="Toggle reading direction" style={{ ...chromeBtn, width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 600, gap: 6 }}><Ic name={rtl ? 'arrow-left' : 'arrow-right'} size={15} /> {rtl ? 'RTL' : 'LTR'}</button>}
          <button onClick={() => setStoryOn(s => !s)} title={storyOn ? 'Exit Story mode' : 'Story mode'} aria-label="Story mode" style={{ ...chromeBtn, background: storyOn ? 'rgb(var(--accent))' : chromeBtn.background }}><Ic name="book-open" size={18} /></button>
        </div>
        {/* On narrow screens the reading-mode switch gets its own full-width row */}
        {!wide && (
          <div style={{ marginTop: 10 }}>
            <_RSeg
              options={[
                { value: 'tap', label: 'Tap', icon: <Ic name="pointer" size={15} /> },
                { value: 'swipe', label: 'Swipe', icon: <Ic name="move-horizontal" size={15} /> },
                { value: 'scroll', label: 'Scroll', icon: <Ic name="gallery-vertical" size={15} /> },
              ]}
              value={mode} onChange={setMode} className="reader-seg reader-seg-full" />
          </div>
        )}
      </div>

      {/* ===== Bottom scrubber (demoted; appears with chrome) ===== */}
      <div style={{ position: 'absolute', left: wide && railOpen ? RAIL_W : 0, right: showStorySide ? STORY_W : 0, bottom: bottomOffset, zIndex: 40, transform: chromeOn ? 'translateY(0)' : 'translateY(110%)', transition: 'transform 240ms var(--ease, ease)', background: 'linear-gradient(to top, rgb(0 0 0 / 0.9), rgb(0 0 0 / 0))', padding: '24px 14px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => prevCh && pickChapter2(prevCh.n, prevCh.pages)} disabled={!prevCh} title="Previous chapter" style={{ ...chromeBtn, opacity: prevCh ? 1 : 0.25 }}><Ic name="chevrons-left" size={18} /></button>
          <button onClick={() => go(-1)} title="Previous page" style={chromeBtn}><Ic name="chevron-left" size={18} /></button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, opacity: 0.7, minWidth: 30, textAlign: 'right' }} className="bindery-nums">{page}</span>
            <input type="range" min="1" max={total} value={page} onChange={e => seek(+e.target.value)} style={{ flex: 1, accentColor: 'rgb(var(--accent))', cursor: 'pointer' }} />
            <span style={{ fontSize: 12, opacity: 0.5, minWidth: 30 }} className="bindery-nums">{total}</span>
          </div>
          <button onClick={() => go(+1)} title="Next page" style={chromeBtn}><Ic name="chevron-right" size={18} /></button>
          <button onClick={() => nextCh && pickChapter2(nextCh.n, 1)} disabled={!nextCh} title="Next chapter" style={{ ...chromeBtn, opacity: nextCh ? 1 : 0.25 }}><Ic name="chevrons-right" size={18} /></button>
        </div>
      </div>

      {/* mobile rail drawer */}
      {!wide && drawer && (
        <ChapterRail series={series} chapters={chs} chapter={ch} page={page} total={total} onJumpPage={(n) => { seek(n); setDrawer(false); }} onPickChapter={pickChapter} onClose={() => setDrawer(false)} drawer />
      )}
    </div>
  );
}

const chromeBtn = { background: 'rgb(0 0 0 / 0.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#fff', border: 'none', cursor: 'pointer', minWidth: 40, height: 40, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
function sideArrow(side) {
  return { position: 'absolute', top: '50%', [side]: 16, transform: 'translateY(-50%)', zIndex: 20, width: 52, height: 52, borderRadius: '50%', background: 'rgb(0 0 0 / 0.4)', backdropFilter: 'blur(8px)', color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 };
}

Object.assign(window, { Reader });
