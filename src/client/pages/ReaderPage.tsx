import {
  useEffect, useState, useCallback, useRef, useMemo, type CSSProperties,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  PanelLeft, Pointer, MoveHorizontal, GalleryVertical, BookOpen,
  Maximize2, ArrowLeftRight, FoldVertical,
} from 'lucide-react';
import {
  getPdfUrl, updateProgress, getComics, getSeriesDetail, saveReaderPrefs,
  getTranslationStatus, getPageTranslation, type PageTranslation,
} from '../lib/api';
import PdfViewer, { type PdfViewerHandle } from '../components/PdfViewer';
import StripViewer from '../components/StripViewer';
import { usePdfDocument, getPageRatios, type PdfDoc } from '../lib/pdf';
import StoryPanel from '../components/StoryPanel';
import ChapterRail from '../components/ChapterRail';
import { SegmentedControl } from '../components/ds';
import type { Comic, ReaderPrefs, Series } from '../lib/types';

const RAIL_W = 304;
const STORY_W = 384;
const STORY_BOTTOM = '42dvh';
const BREAKPOINT = 900;
const HIDE_MS = 3200;
const SWIPE_THRESHOLD_PCT = 0.18;
/**
 * Chrome auto-reveals only when the pointer/touch is within EDGE_ZONE_PX
 * of the top or bottom of the viewport (where the chrome lives).
 * Otherwise page-turn actions, scrolling through the middle of the page,
 * and middle-of-screen swipes leave the chrome alone — the reader stays
 * immersive instead of flashing the bars every flip.
 */
const EDGE_ZONE_PX = 80;

/** How pages are turned in the Pages layout — a personal, per-device habit. */
type Turn = 'tap' | 'swipe';
/** The top-bar control: the two page-turn styles, or the continuous strip. */
type Mode = Turn | 'strip';

/** Pages at least this tall (height / width) read as a webtoon strip. */
const STRIP_RATIO = 2;
const STRIP_TAGS = new Set(['webtoon', 'webtoons', 'long strip']);

const prefsKey = (seriesId: string) => `bindery.reader.series.${seriesId}`;
function readLocalPrefs(seriesId: string): ReaderPrefs {
  try { return JSON.parse(localStorage.getItem(prefsKey(seriesId)) || '{}') || {}; } catch { return {}; }
}

/**
 * Series tags that imply right-to-left reading (manga-family). Used to
 * auto-set the RTL toggle when entering a chapter.
 */
const RTL_TAGS = new Set([
  'manga', 'manhwa', 'doujinshi', 'japanese',
  'shounen', 'shonen', 'seinen', 'isekai',
]);

/**
 * Reader — full-viewport theme-independent dark surface, 3-zone layout:
 *
 *   [ ChapterRail (304, desktop) ] [ reading surface ] [ StoryPanel (384, story on + wide) ]
 *
 * On mobile (<900px) the rail moves into a drawer + the top-bar splits into
 * two rows (controls below).
 *
 * Two layouts: Pages (one page at a time, turned by Tap thirds or Swipe, shown
 * whole or fitted to the art's width) and Strip (the whole chapter as one
 * continuous scroll, for webtoons). Layout, fit, direction and gap trimming
 * are saved per user per series — how one person reads a series never changes
 * it for anyone else — and default to what the pages themselves suggest.
 * Tap vs Swipe is a per-device habit and stays in localStorage.
 *
 * RTL only flips *which side advances reading*; the page counter and toolbar
 * prev/next stay direction-agnostic.
 *
 * Chrome auto-hides after 3.2s of inactivity. Mouse-move (desktop) / tap
 * (mobile) / key-press / page-flip pokes it back. The bottom scrubber is
 * demoted from primary nav to a jump affordance.
 *
 * Story-mode fetching, narration panel, citation overlay, ambient backdrop,
 * #first / #last cross-chapter landing flow, and server-side progress
 * tracking are preserved from the previous implementation.
 */
export default function ReaderPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const seriesId = params.id || '';
  const file = params['*'] || '';

  const [series, setSeries] = useState<Series | null>(null);
  const [comics, setComics] = useState<Comic[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Page-turn habit persists per device, across series and chapters.
  const [turn, setTurn] = useState<Turn>(() =>
    (localStorage.getItem('bindery.reader.mode') === 'swipe' ? 'swipe' : 'tap'),
  );
  useEffect(() => { try { localStorage.setItem('bindery.reader.mode', turn); } catch { /* ignore */ } }, [turn]);

  // This reader's settings for this series. Seeded from the device copy so the
  // first paint is already right; the server copy (which follows the user
  // across devices) replaces it when it is newer.
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => readLocalPrefs(seriesId));
  useEffect(() => { setPrefs(readLocalPrefs(seriesId)); }, [seriesId]);
  useEffect(() => {
    const remote = series?.id === seriesId ? series.readerPrefs : null;
    if (!remote) return;
    setPrefs((local) => ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : local));
  }, [series, seriesId]);
  const updatePrefs = useCallback((patch: Partial<ReaderPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch, updatedAt: Date.now() };
      try { localStorage.setItem(prefsKey(seriesId), JSON.stringify(next)); } catch { /* ignore */ }
      // Offline or a failed save just leaves the device copy in charge.
      saveReaderPrefs(seriesId, next).catch(() => {});
      return next;
    });
  }, [seriesId]);

  // 900px breakpoint
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${BREAKPOINT}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${BREAKPOINT}px)`);
    const h = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Rail (desktop inline) vs drawer (mobile)
  const [railOpen, setRailOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);

  // Auto-hide chrome. The bars only reveal when the user actually reaches
  // for them: pointer or touch within EDGE_ZONE_PX of the top or bottom of
  // the viewport, an explicit center-tap in Tap/Swipe modes, or a chapter
  // boundary (so the new chapter's title isn't a mystery). Page-turn taps,
  // keyboard nav, and middle-of-screen swipes leave chrome alone.
  const [chromeOn, setChromeOn] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const poke = useCallback(() => {
    setChromeOn(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChromeOn(false), HIDE_MS);
  }, []);
  const pokeIfNearEdge = useCallback((y: number) => {
    const h = window.innerHeight;
    if (y < EDGE_ZONE_PX || y > h - EDGE_ZONE_PX) poke();
  }, [poke]);
  // Initial reveal + cleanup, plus a re-poke on chapter boundary so the new
  // title gets its 3.2s of fame. NOT on page change (that was the chaos
  // the user flagged) and NOT on mode change (the user just clicked chrome).
  useEffect(() => {
    poke();
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, [poke, file]);

  // Story mode
  const [storyAvailable, setStoryAvailable] = useState(false);
  const [storyOn, setStoryOn] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState<PageTranslation | null>(null);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [ambient, setAmbient] = useState<string | null>(null);
  const [highlightedOrder, setHighlightedOrder] = useState<number | null>(null);
  const translationsRef = useRef<Map<number, PageTranslation>>(new Map());

  // RTL auto + manual override
  const rtlAuto = useMemo(
    () => (series?.tags || []).some((t) => RTL_TAGS.has(t.toLowerCase())),
    [series],
  );
  const rtl = (prefs.direction ?? (rtlAuto ? 'rtl' : 'ltr')) === 'rtl';

  // ----- The chapter PDF, and what its pages suggest -----
  const doc = usePdfDocument(getPdfUrl(seriesId, file));
  const [detected, setDetected] = useState<{ doc: PdfDoc; strip: boolean } | null>(null);
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    getPageRatios(doc).then((ratios) => {
      if (cancelled) return;
      const sorted = [...ratios].sort((a, b) => a - b);
      setDetected({ doc, strip: sorted[sorted.length >> 1] >= STRIP_RATIO });
    }).catch(() => { if (!cancelled) setDetected({ doc, strip: false }); });
    return () => { cancelled = true; };
  }, [doc]);
  const stripTagged = useMemo(
    () => (series?.tags || []).some((t) => STRIP_TAGS.has(t.toLowerCase())),
    [series],
  );
  // null while we don't know yet — the surface stays dark rather than
  // flashing the wrong layout.
  const layout: 'pages' | 'strip' | null =
    prefs.layout
    ?? (detected && detected.doc === doc ? (detected.strip || stripTagged ? 'strip' : 'pages') : null);
  const fitWidth = (prefs.fit ?? 'page') === 'width';
  const trimGaps = (prefs.gaps ?? 'trim') === 'trim';
  const mode: Mode = layout === 'strip' ? 'strip' : turn;
  const setMode = useCallback((next: Mode) => {
    if (next === 'strip') { updatePrefs({ layout: 'strip' }); return; }
    setTurn(next);
    if (layout !== 'pages') updatePrefs({ layout: 'pages' });
  }, [layout, updatePrefs]);

  const viewerRef = useRef<PdfViewerHandle | null>(null);
  const pageRef = useRef(0);
  const pageFileRef = useRef('');
  const totalRef = useRef(0);
  const lastSavedPage = useRef(-1);

  // Disable browser pinch-zoom while reading
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute('content') || '';
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1');
    return () => {
      if (meta) meta.setAttribute('content', original || 'width=device-width, initial-scale=1');
    };
  }, []);

  // ----- Load series + comics -----
  useEffect(() => {
    if (!seriesId) return;
    getSeriesDetail(seriesId).then(setSeries);
    getComics(seriesId).then(setComics);
  }, [seriesId]);

  // ----- Story availability -----
  useEffect(() => {
    if (!seriesId || !file) return;
    let cancelled = false;
    getTranslationStatus(seriesId, file)
      .then((s) => { if (!cancelled) setStoryAvailable(s.cachedPages.length > 0); })
      .catch(() => { if (!cancelled) setStoryAvailable(false); });
    return () => { cancelled = true; };
  }, [seriesId, file]);
  useEffect(() => { if (!storyAvailable) setStoryOn(false); }, [storyAvailable]);

  const currentIndex = useMemo(
    () => comics.findIndex((c) => c.file === file),
    [comics, file],
  );
  const prevChapter = currentIndex > 0 ? comics[currentIndex - 1] : null;
  const nextChapter = currentIndex < comics.length - 1 ? comics[currentIndex + 1] : null;
  const currentComic = currentIndex >= 0 ? comics[currentIndex] : null;

  // Where to land on chapter load:
  //   #first  → page 0
  //   #last   → last page (when known)
  //   default → server-side last-read position
  const initialPage =
    location.hash === '#first' ? 0
    : location.hash === '#last' && currentComic?.pages ? currentComic.pages - 1
    : currentComic?.currentPage || 0;

  // ----- Progress tracking -----
  const handlePageChange = useCallback(
    (page: number, total: number) => {
      pageRef.current = page;
      pageFileRef.current = file;
      totalRef.current = total;
      setCurrentPage(page);
      setTotalPages(total);
      setHighlightedOrder(null);
      if (page !== lastSavedPage.current) {
        lastSavedPage.current = page;
        updateProgress(seriesId, file, { currentPage: page, pageCount: total });
      }
    },
    [seriesId, file],
  );

  const handleTotalPages = useCallback((total: number) => {
    totalRef.current = total;
    setTotalPages(total);
  }, []);

  // Stable callback for the StoryPanel's read-aloud auto-advance.
  const requestNextPage = useCallback((): boolean => {
    if (pageRef.current < totalRef.current - 1) {
      viewerRef.current?.nextPage();
      return true;
    }
    return false;
  }, []);

  // Per-chapter state reset on file change
  useEffect(() => {
    lastSavedPage.current = -1;
    translationsRef.current.clear();
    setCurrentTranslation(null);
    setHighlightedOrder(null);
    setAmbient(null);
  }, [file]);

  // Apply the #first / #last landing hint once page count is known
  const hashAppliedRef = useRef<string | null>(null);
  useEffect(() => { hashAppliedRef.current = null; }, [file]);
  useEffect(() => {
    if (totalPages === 0) return;
    if (hashAppliedRef.current === file) return;
    const hash = location.hash;
    if (hash !== '#first' && hash !== '#last') return;
    hashAppliedRef.current = file;
    if (hash === '#last') viewerRef.current?.goToPage(totalPages - 1);
    navigate(`/read/${seriesId}/${file}`, { replace: true });
  }, [location.hash, totalPages, file, navigate, seriesId]);

  // Story narration fetch
  useEffect(() => {
    if (!storyOn) {
      setCurrentTranslation(null);
      setNarrationLoading(false);
      return;
    }
    const cached = translationsRef.current.get(currentPage);
    if (cached) {
      setCurrentTranslation(cached);
      setNarrationLoading(false);
      return;
    }
    setCurrentTranslation(null);
    setNarrationLoading(true);
    let cancelled = false;
    getPageTranslation(seriesId, file, currentPage)
      .then((pt) => {
        if (cancelled) return;
        if (pt) translationsRef.current.set(currentPage, pt);
        setCurrentTranslation(pt);
        setNarrationLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setCurrentTranslation(null); setNarrationLoading(false); }
      });
    return () => { cancelled = true; };
  }, [storyOn, currentPage, seriesId, file]);

  const highlightBox = useMemo(() => {
    if (highlightedOrder == null || !currentTranslation) return null;
    return currentTranslation.bubbles.find((b) => b.order === highlightedOrder)?.bbox ?? null;
  }, [highlightedOrder, currentTranslation]);

  // ----- Direction-aware page navigation -----
  // delta = +1 always means "advance one page" (counter goes up); chapter
  // boundaries flow into the next/previous chapter. RTL only affects which
  // INPUT advances reading (right vs. left), not this counter direction.
  const goToChapter = useCallback((comic: Comic, at?: 'first' | 'last') => {
    const hash = at ? `#${at}` : '';
    navigate(`/read/${seriesId}/${comic.file}${hash}`, { replace: true });
  }, [navigate, seriesId]);

  // `go` is one reading step from tap / swipe / keys: the viewer scrolls
  // within a tall page (fit-width, strip) before it moves on. `turnPage` is
  // the toolbar's exact one-page move. Both flow across chapter boundaries
  // through the viewer's onPastEnd / onPastStart.
  const go = useCallback((delta: number) => { viewerRef.current?.step(delta); }, []);
  const turnPage = useCallback((delta: number) => {
    if (delta > 0) viewerRef.current?.nextPage();
    else viewerRef.current?.prevPage();
  }, []);
  const toNextChapter = useCallback(
    () => { if (nextChapter) goToChapter(nextChapter, 'first'); },
    [nextChapter, goToChapter],
  );
  const toPrevChapter = useCallback(
    () => { if (prevChapter) goToChapter(prevChapter, 'last'); },
    [prevChapter, goToChapter],
  );

  // Switching layout mid-chapter keeps your place; a new chapter starts where
  // the server says you left off.
  const startPage = useMemo(
    () => (pageFileRef.current === file ? pageRef.current : initialPage),
    // `layout` is listed so the value refreshes exactly when the viewer remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [file, layout, initialPage],
  );

  // Swipe on a surface that also scrolls (fit-width): a mostly-horizontal
  // drag past the threshold turns the page, a still tap toggles the chrome,
  // and anything vertical is left to the browser's scroll.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeEnd = useCallback((x: number, y: number) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.abs(dx) >= window.innerWidth * SWIPE_THRESHOLD_PCT && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) go(rtl ? -1 : +1);
      else go(rtl ? +1 : -1);
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      setChromeOn((c) => !c);
    }
  }, [go, rtl]);

  // ----- Keyboard -----
  // Keyboard nav is intentionally chrome-quiet — arrow keys / Space flip
  // pages without revealing the bars, matching the user's "every page turn
  // shouldn't pop chrome" preference.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') { navigate(`/series/${seriesId}`); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(rtl ? -1 : +1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(rtl ? +1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, rtl, navigate, seriesId]);

  // ----- Tap surface: vertical-thirds click handler -----
  const onTapSurface = useCallback((e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 1 / 3) go(rtl ? +1 : -1);
    else if (x > 2 / 3) go(rtl ? -1 : +1);
    else setChromeOn((c) => !c);
  }, [go, rtl]);

  if (!currentComic) {
    // Keep the dark surface while loading so nothing flashes light first.
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }} />
    );
  }

  const controls: ReaderControlsProps = {
    mode,
    onMode: setMode,
    fitWidth,
    onFitWidth: (v) => updatePrefs({ fit: v ? 'width' : 'page' }),
    rtl,
    onRtl: (v) => updatePrefs({ direction: v ? 'rtl' : 'ltr' }),
    trimGaps,
    onTrimGaps: (v) => updatePrefs({ gaps: v ? 'trim' : 'keep' }),
  };

  // ----- Layout -----
  const showStorySide = storyOn && wide;
  const showStoryStrip = storyOn && !wide;
  const leftInset = wide && railOpen ? RAIL_W : 0;
  const rightInset = showStorySide ? STORY_W : 0;
  const bottomInset = showStoryStrip ? STORY_BOTTOM : '0px';

  return (
    <div
      onMouseMove={(e) => pokeIfNearEdge(e.clientY)}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) pokeIfNearEdge(t.clientY);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a0a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
        {/* Desktop rail */}
        {wide && railOpen && (
          <div style={{ width: RAIL_W, flexShrink: 0, height: '100%' }}>
            <ChapterRail
              series={series}
              comics={comics}
              currentComic={currentComic}
              seriesId={seriesId}
              currentPage={currentPage}
              totalPages={totalPages}
              onJumpPage={(n) => viewerRef.current?.goToPage(n)}
              getPageThumbnail={(n, w) => viewerRef.current?.getPageThumbnail(n, w) ?? Promise.resolve(null)}
            />
          </div>
        )}

        {/* Center reading surface */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {/* The reading surface. In Strip and fit-width the viewer scrolls,
              so input is read from this wrapper (clicks and drags bubble up
              through the scrolling content). Whole-page mode keeps its
              dedicated overlays below. */}
          <div
            style={{ position: 'absolute', inset: 0 }}
            {...(layout === 'strip'
              ? { onClick: () => setChromeOn((c) => !c) }
              : layout === 'pages' && fitWidth && turn === 'tap'
                ? { onClick: onTapSurface }
                : layout === 'pages' && fitWidth
                  ? {
                      onTouchStart: (e: React.TouchEvent) => {
                        const t = e.touches[0];
                        swipeStart.current = { x: t.clientX, y: t.clientY };
                      },
                      onTouchEnd: (e: React.TouchEvent) => {
                        const t = e.changedTouches[0];
                        swipeEnd(t.clientX, t.clientY);
                      },
                      onMouseDown: (e: React.MouseEvent) => {
                        swipeStart.current = { x: e.clientX, y: e.clientY };
                      },
                      onMouseUp: (e: React.MouseEvent) => swipeEnd(e.clientX, e.clientY),
                    }
                  : {})}
          >
            {doc && layout === 'strip' && (
              <StripViewer
                key={file}
                ref={viewerRef}
                doc={doc}
                initialPage={startPage}
                trimGaps={trimGaps}
                onPageChange={handlePageChange}
                onTotalPagesChange={handleTotalPages}
                onAmbient={storyOn ? setAmbient : undefined}
                nextLabel={nextChapter ? chapterLabel(nextChapter) : null}
                prevLabel={prevChapter ? chapterLabel(prevChapter) : null}
                onPastEnd={toNextChapter}
                onPastStart={toPrevChapter}
              />
            )}
            {doc && layout === 'pages' && (
              <PdfViewer
                key={file}
                ref={viewerRef}
                doc={doc}
                initialPage={startPage}
                viewMode={fitWidth ? 'scroll' : 'fit'}
                onPageChange={handlePageChange}
                onTotalPagesChange={handleTotalPages}
                overlay={storyOn ? { page: currentPage, highlight: highlightBox } : null}
                onAmbient={storyOn ? setAmbient : undefined}
                onPastEnd={toNextChapter}
                onPastStart={toPrevChapter}
              />
            )}
          </div>

          {/* Input overlays — whole-page mode only. */}
          {layout === 'pages' && !fitWidth && turn === 'tap' && (
            <div
              onClick={onTapSurface}
              style={{
                position: 'absolute', inset: 0, zIndex: 5, cursor: 'pointer',
              }}
            />
          )}
          {layout === 'pages' && !fitWidth && turn === 'swipe' && (
            <SwipeOverlay
              onSwipe={(dx) => {
                const w = window.innerWidth;
                const threshold = w * SWIPE_THRESHOLD_PCT;
                if (dx <= -threshold) go(rtl ? -1 : +1);
                else if (dx >= threshold) go(rtl ? +1 : -1);
                else setChromeOn((c) => !c);
              }}
            />
          )}

          {/* Desktop side arrows — paged modes only, chrome visible */}
          {wide && layout === 'pages' && chromeOn && (
            <>
              <button
                onClick={() => go(rtl ? +1 : -1)}
                aria-label={rtl ? 'Next page' : 'Previous page'}
                style={sideArrow('left')}
              >
                <ChevronLeft size={26} />
              </button>
              <button
                onClick={() => go(rtl ? -1 : +1)}
                aria-label={rtl ? 'Previous page' : 'Next page'}
                style={sideArrow('right')}
              >
                <ChevronRight size={26} />
              </button>
            </>
          )}
        </div>

        {/* Story side rail */}
        {showStorySide && (
          <div style={{ width: STORY_W, flexShrink: 0, height: '100%' }}>
            <StoryPanel
              page={currentPage}
              narration={currentTranslation?.narration ?? ''}
              bubbles={currentTranslation?.bubbles ?? []}
              loading={narrationLoading}
              ambient={ambient}
              highlightedOrder={highlightedOrder}
              onCiteBubble={setHighlightedOrder}
              onClose={() => setStoryOn(false)}
              onRequestNextPage={requestNextPage}
            />
          </div>
        )}
      </div>

      {/* Story bottom strip (narrow only) */}
      {showStoryStrip && (
        <div style={{ height: STORY_BOTTOM, flexShrink: 0 }}>
          <StoryPanel
            page={currentPage}
            narration={currentTranslation?.narration ?? ''}
            bubbles={currentTranslation?.bubbles ?? []}
            loading={narrationLoading}
            ambient={ambient}
            highlightedOrder={highlightedOrder}
            onCiteBubble={setHighlightedOrder}
            onClose={() => setStoryOn(false)}
            onRequestNextPage={requestNextPage}
          />
        </div>
      )}

      {/* ===== TOP BAR (auto-hide) ===== */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: leftInset,
          right: rightInset,
          zIndex: 40,
          transform: chromeOn ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 240ms ease',
          background: 'linear-gradient(to bottom, rgb(0 0 0 / 0.85), rgb(0 0 0 / 0))',
          padding: `calc(env(safe-area-inset-top, 0px) + 10px) 12px 20px`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(`/series/${seriesId}`)}
            title={series?.name || 'Back to series'}
            aria-label="Back to series"
            style={chromeBtn}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={() => (wide ? setRailOpen((r) => !r) : setDrawer(true))}
            title="Chapters & pages"
            aria-label="Chapters and pages"
            style={chromeBtn}
          >
            <PanelLeft size={18} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            {!(wide && railOpen) && series && (
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {series.name}
              </div>
            )}
            <div className="bindery-nums" style={{ fontSize: 12, opacity: 0.7 }}>
              {currentComic.order > 0 && <>Chapter {currentComic.order} · </>}
              Page {currentPage + 1} / {totalPages || '?'}
            </div>
          </div>
          {wide && <ReaderControls {...controls} />}
          {storyAvailable && (
            <button
              onClick={() => setStoryOn((s) => !s)}
              title={storyOn ? 'Exit Story mode' : 'Story mode'}
              aria-label={storyOn ? 'Exit Story mode' : 'Story mode'}
              style={{
                ...chromeBtn,
                background: storyOn ? 'rgb(var(--accent))' : chromeBtn.background,
              }}
            >
              <BookOpen size={18} />
            </button>
          )}
        </div>
        {/* Narrow screen: the controls get their own full-width row */}
        {!wide && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <ReaderControls {...controls} compact />
          </div>
        )}
      </div>

      {/* ===== BOTTOM SCRUBBER (auto-hide, demoted) ===== */}
      <div
        style={{
          position: 'absolute',
          left: leftInset,
          right: rightInset,
          bottom: bottomInset,
          zIndex: 40,
          transform: chromeOn ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 240ms ease',
          background: 'linear-gradient(to top, rgb(0 0 0 / 0.9), rgb(0 0 0 / 0))',
          padding: `24px 14px calc(env(safe-area-inset-bottom, 0px) + 16px)`,
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => prevChapter && goToChapter(prevChapter, 'last')}
            disabled={!prevChapter}
            title="Previous chapter"
            style={{ ...chromeBtn, opacity: prevChapter ? 1 : 0.25 }}
          >
            <ChevronsLeft size={18} />
          </button>
          <button
            onClick={() => turnPage(-1)}
            title="Previous page"
            style={chromeBtn}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="bindery-nums"
              style={{ fontSize: 12, opacity: 0.7, minWidth: 30, textAlign: 'right' }}
            >
              {currentPage + 1}
            </span>
            <input
              type="range"
              min={1}
              max={Math.max(1, totalPages)}
              value={currentPage + 1}
              onChange={(e) => viewerRef.current?.goToPage(parseInt(e.target.value, 10) - 1)}
              style={{ flex: 1, minWidth: 0, accentColor: 'rgb(var(--accent))', cursor: 'pointer' }}
            />
            <span
              className="bindery-nums"
              style={{ fontSize: 12, opacity: 0.5, minWidth: 30 }}
            >
              {totalPages || '?'}
            </span>
          </div>
          <button
            onClick={() => turnPage(+1)}
            title="Next page"
            style={chromeBtn}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => nextChapter && goToChapter(nextChapter, 'first')}
            disabled={!nextChapter}
            title="Next chapter"
            style={{ ...chromeBtn, opacity: nextChapter ? 1 : 0.25 }}
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      </div>

      {/* Mobile rail drawer */}
      {!wide && drawer && (
        <ChapterRail
          series={series}
          comics={comics}
          currentComic={currentComic}
          seriesId={seriesId}
          currentPage={currentPage}
          totalPages={totalPages}
          onJumpPage={(n) => { viewerRef.current?.goToPage(n); setDrawer(false); }}
          getPageThumbnail={(n, w) => viewerRef.current?.getPageThumbnail(n, w) ?? Promise.resolve(null)}
          onClose={() => setDrawer(false)}
          drawer
        />
      )}
    </div>
  );
}

function chapterLabel(c: Comic): string {
  return c.order > 0 ? `Chapter ${c.order}` : 'the next chapter';
}

interface ReaderControlsProps {
  mode: Mode;
  onMode: (m: Mode) => void;
  fitWidth: boolean;
  onFitWidth: (v: boolean) => void;
  rtl: boolean;
  onRtl: (v: boolean) => void;
  trimGaps: boolean;
  onTrimGaps: (v: boolean) => void;
  /** Narrow screens: full-width mode switcher, icon-only option buttons. */
  compact?: boolean;
}

/**
 * The reading controls: how to move through the chapter (Tap / Swipe / Strip)
 * plus the options that apply to that choice — fit and direction for pages,
 * gap trimming for the strip. Everything but Tap-vs-Swipe is remembered for
 * this series.
 */
function ReaderControls({
  mode, onMode, fitWidth, onFitWidth, rtl, onRtl, trimGaps, onTrimGaps, compact,
}: ReaderControlsProps) {
  const option = (active: boolean): CSSProperties => ({
    ...chromeBtn,
    width: 'auto',
    padding: compact ? '0 11px' : '0 12px',
    fontSize: 12,
    fontWeight: 600,
    gap: 6,
    background: active ? 'rgb(var(--accent) / 0.85)' : chromeBtn.background,
  });
  return (
    <>
      <SegmentedControl
        options={[
          { value: 'tap', label: 'Tap', icon: <Pointer size={15} /> },
          { value: 'swipe', label: 'Swipe', icon: <MoveHorizontal size={15} /> },
          { value: 'strip', label: 'Strip', icon: <GalleryVertical size={15} /> },
        ]}
        value={mode}
        onChange={onMode}
        className={compact ? 'reader-seg reader-seg-full' : 'reader-seg'}
      />
      {mode === 'strip' ? (
        <button
          onClick={() => onTrimGaps(!trimGaps)}
          aria-pressed={trimGaps}
          title={trimGaps ? 'Blank gaps are trimmed — show them as drawn' : 'Trim the blank gaps between frames'}
          aria-label="Trim blank gaps"
          style={option(trimGaps)}
        >
          <FoldVertical size={15} />
          {!compact && 'Trim gaps'}
        </button>
      ) : (
        <>
          <button
            onClick={() => onFitWidth(!fitWidth)}
            title={fitWidth ? 'Fitting the art to the screen width — show the whole page' : 'Fit the art to the screen width'}
            aria-label={fitWidth ? 'Show the whole page' : 'Fit to width'}
            style={option(false)}
          >
            {fitWidth ? <ArrowLeftRight size={15} /> : <Maximize2 size={15} />}
            {!compact && (fitWidth ? 'Fit width' : 'Fit page')}
          </button>
          <button
            onClick={() => onRtl(!rtl)}
            title={rtl ? 'Right-to-left (manga)' : 'Left-to-right'}
            aria-label="Toggle reading direction"
            style={option(false)}
          >
            {rtl ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
            {rtl ? 'RTL' : 'LTR'}
          </button>
        </>
      )}
    </>
  );
}

const chromeBtn: CSSProperties = {
  background: 'rgb(0 0 0 / 0.45)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  minWidth: 40,
  height: 40,
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

function sideArrow(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 16,
    transform: 'translateY(-50%)',
    zIndex: 20,
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'rgb(0 0 0 / 0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  };
}

/**
 * Drag-to-flip overlay. Captures the delta-x on release and hands it to
 * onSwipe; the parent compares against an 18%-of-width threshold to commit
 * a flip vs. treat it as a tap (toggle chrome).
 */
function SwipeOverlay({ onSwipe }: { onSwipe: (dx: number) => void }) {
  const stateRef = useRef({ active: false, x0: 0, dx: 0 });
  const down = (x: number) => { stateRef.current = { active: true, x0: x, dx: 0 }; };
  const move = (x: number) => {
    if (!stateRef.current.active) return;
    stateRef.current.dx = x - stateRef.current.x0;
  };
  const up = () => {
    if (!stateRef.current.active) return;
    const dx = stateRef.current.dx;
    stateRef.current = { active: false, x0: 0, dx: 0 };
    onSwipe(dx);
  };
  return (
    <div
      onMouseDown={(e) => down(e.clientX)}
      onMouseMove={(e) => move(e.clientX)}
      onMouseUp={up}
      onMouseLeave={up}
      onTouchStart={(e) => down(e.touches[0].clientX)}
      onTouchMove={(e) => move(e.touches[0].clientX)}
      onTouchEnd={up}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'pan-y',
      }}
    />
  );
}
