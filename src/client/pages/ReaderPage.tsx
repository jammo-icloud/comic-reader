import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ChevronUp, ChevronDown, Maximize2, ScrollText, Sun, Moon,
} from 'lucide-react';
import { getPdfUrl, updateProgress, getComics, getSeriesDetail } from '../lib/api';
import PdfViewer, { type PdfViewerHandle, type ViewMode, type ReadingDirection } from '../components/PdfViewer';
import { useTheme } from '../lib/theme';
import type { Comic, Series } from '../lib/types';

export default function ReaderPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { isDark, toggleDarkLight } = useTheme();
  const seriesId = params.id || '';
  const file = params['*'] || '';

  const [series, setSeries] = useState<Series | null>(null);
  const [comics, setComics] = useState<Comic[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('fit');
  // Toolbar is up by default — without it the user has no way to flip pages.
  // The tray chevron lets them collapse it for a distraction-free view.
  const [uiVisible, setUiVisible] = useState(true);
  const lastSavedPage = useRef(-1);
  const viewerRef = useRef<PdfViewerHandle | null>(null);

  // Auto-detect reading direction from series tags
  const readingDirection: ReadingDirection = useMemo(() => {
    const tags = (series?.tags || []).map((t) => t.toLowerCase());
    return tags.some((t) => ['manga', 'manhwa', 'doujinshi', 'japanese'].includes(t)) ? 'rtl' : 'ltr';
  }, [series]);

  // ----- Lock viewport meta — disable browser pinch zoom while reading -----
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

  const currentIndex = useMemo(
    () => comics.findIndex((c) => c.file === file),
    [comics, file],
  );
  const prevChapter = currentIndex > 0 ? comics[currentIndex - 1] : null;
  const nextChapter = currentIndex < comics.length - 1 ? comics[currentIndex + 1] : null;
  const currentComic = currentIndex >= 0 ? comics[currentIndex] : null;

  // ----- Progress tracking -----
  const handlePageChange = useCallback(
    (page: number, total: number) => {
      setCurrentPage(page);
      setTotalPages(total);
      if (page !== lastSavedPage.current) {
        lastSavedPage.current = page;
        updateProgress(seriesId, file, { currentPage: page, pageCount: total });
      }
    },
    [seriesId, file],
  );

  useEffect(() => {
    lastSavedPage.current = -1;
  }, [file]);

  // ----- UI toggle (drawer chevron on the toolbar is the only way to show/hide) -----
  const toggleUi = useCallback(() => {
    setUiVisible((v) => !v);
  }, []);

  // ----- Chapter nav -----
  const goToChapter = (comic: Comic) => {
    navigate(`/read/${seriesId}/${comic.file}`, { replace: true });
  };

  // ----- ESC closes -----
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(`/series/${seriesId}`);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, seriesId]);

  return (
    <div className="h-[100dvh] w-screen bg-white dark:bg-black overflow-hidden relative">
      {/* PDF Viewer fills the screen */}
      <div className="absolute inset-0">
        <PdfViewer
          ref={viewerRef}
          url={getPdfUrl(seriesId, file)}
          initialPage={currentComic?.currentPage || 0}
          viewMode={viewMode}
          readingDirection={readingDirection}
          onPageChange={handlePageChange}
          onTotalPagesChange={setTotalPages}
        />
      </div>

      {/* Floating top-left back button — always visible, primary escape hatch.
          top/left use safe-area-inset so the button clears Dynamic Island in
          standalone PWA mode (status-bar-style: black-translucent). */}
      <button
        onClick={() => navigate(`/series/${seriesId}`)}
        className="absolute z-30 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-all"
        style={{
          top: 'max(0.75rem, env(safe-area-inset-top))',
          left: 'max(0.75rem, env(safe-area-inset-left))',
        }}
        title={series?.name || 'Back'}
      >
        <ArrowLeft size={18} />
      </button>

      {/* Persistent tray toggle — always visible, toggles toolbar.
          Sits centered just above the bottom safe area so it never overlaps the toolbar's first row. */}
      <button
        onClick={toggleUi}
        className={`absolute left-1/2 -translate-x-1/2 z-40 px-3 py-2 rounded-t-md bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-all ${uiVisible ? 'opacity-60' : 'opacity-90'}`}
        style={{
          // When toolbar is up: sit on top of the toolbar (toolbar is ~5.25rem tall + safe area).
          // When down: float well clear of the iOS home-indicator gesture zone.
          // The bottom 20pt is iOS-reserved for swipe-up; we add 1.5rem so the
          // tray's tap target sits in user space, not Apple-edge space.
          bottom: uiVisible
            ? 'calc(env(safe-area-inset-bottom) + 5.25rem)'
            : 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        }}
        title={uiVisible ? 'Hide controls' : 'Show controls'}
        aria-label={uiVisible ? 'Hide controls' : 'Show controls'}
      >
        {uiVisible ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>

      {/* Floating bottom toolbar — single row. Slider flexes; everything else is shrink-0.
          Toggled by the tray chevron.

          - Buttons are 44px (Apple's HIG minimum tap target) via p-3 + size-20 icons.
          - paddingBottom adds 1.5rem clear of safe-area-inset-bottom so the bottom
            row of tap targets sits well above the home-indicator gesture zone
            (iOS reserves the bottom ~20pt for swipe-up; below that, taps feel
            slow or get intercepted as gesture starts).
          - paddingLeft/Right honor safe-area-inset-left/right so landscape iPhone
            with rounded corners doesn't clip the outermost buttons. */}
      <div
        className={`absolute left-0 right-0 bottom-0 z-30 pt-3 bg-gray-900/90 dark:bg-black/90 backdrop-blur-md border-t border-white/10 transition-all text-white ${uiVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
        style={{
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Prev chapter */}
          <button
            onClick={() => prevChapter && goToChapter(prevChapter)}
            disabled={!prevChapter}
            className="p-3 rounded hover:bg-white/10 disabled:opacity-20 transition-colors shrink-0"
            title="Previous chapter"
          >
            <ChevronsLeft size={20} />
          </button>

          {/* Prev page */}
          <button
            onClick={() => viewerRef.current?.prevPage()}
            disabled={currentPage === 0}
            className="p-3 rounded hover:bg-white/10 disabled:opacity-20 transition-colors shrink-0"
            title="Previous page"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Slider takes all remaining space */}
          <input
            type="range"
            min={0}
            max={Math.max(0, totalPages - 1)}
            value={currentPage}
            onChange={(e) => viewerRef.current?.goToPage(parseInt(e.target.value, 10))}
            className="flex-1 h-1 accent-accent cursor-pointer min-w-0"
          />

          {/* Page count */}
          <span className="text-[11px] sm:text-xs tabular-nums whitespace-nowrap shrink-0 px-0.5">
            {totalPages > 0 ? `${currentPage + 1}/${totalPages}` : '—'}
          </span>

          {/* Next page */}
          <button
            onClick={() => viewerRef.current?.nextPage()}
            disabled={currentPage >= totalPages - 1}
            className="p-3 rounded hover:bg-white/10 disabled:opacity-20 transition-colors shrink-0"
            title="Next page"
          >
            <ChevronRight size={20} />
          </button>

          {/* Next chapter */}
          <button
            onClick={() => nextChapter && goToChapter(nextChapter)}
            disabled={!nextChapter}
            className="p-3 rounded hover:bg-white/10 disabled:opacity-20 transition-colors shrink-0"
            title="Next chapter"
          >
            <ChevronsRight size={20} />
          </button>

          {/* Fit / Scroll toggle. Smaller than the nav buttons (paired so they
              read as one control), but still taller than the old p-2 32px target. */}
          <div className="flex bg-white/10 rounded text-xs shrink-0 ml-0.5">
            <button
              onClick={() => setViewMode('fit')}
              className={`p-2.5 rounded-l transition-colors ${viewMode === 'fit' ? 'bg-accent' : 'hover:bg-white/10'}`}
              title="Fit to screen"
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={() => setViewMode('scroll')}
              className={`p-2.5 rounded-r transition-colors ${viewMode === 'scroll' ? 'bg-accent' : 'hover:bg-white/10'}`}
              title="Scroll"
            >
              <ScrollText size={16} />
            </button>
          </div>

          {/* Theme toggle (desktop only — small mobile is too cramped) */}
          <button
            onClick={toggleDarkLight}
            className="hidden sm:block p-2.5 rounded hover:bg-white/10 transition-colors shrink-0"
            title="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
