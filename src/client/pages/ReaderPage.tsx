import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPdfUrl, updateProgress, getComics } from '../lib/api';
import PdfViewer from '../components/PdfViewer';
import ThemeToggle from '../components/ThemeToggle';
import type { Comic } from '../lib/types';

export default function ReaderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const comicPath = decodeURIComponent(location.pathname.replace('/read/', ''));
  const [comic, setComic] = useState<Comic | null>(null);
  const [seriesComics, setSeriesComics] = useState<Comic[]>([]);
  const lastSavedPage = useRef(-1);

  useEffect(() => {
    getComics({ sort: 'series' }).then((all) => {
      const found = all.find((c) => c.path === comicPath);
      if (found) {
        setComic(found);
        const siblings = all
          .filter((c) => c.series === found.series)
          .sort((a, b) => a.seriesOrder - b.seriesOrder);
        setSeriesComics(siblings);
      }
    });
  }, [comicPath]);

  const currentIndex = useMemo(
    () => seriesComics.findIndex((c) => c.path === comicPath),
    [seriesComics, comicPath]
  );
  const prevChapter = currentIndex > 0 ? seriesComics[currentIndex - 1] : null;
  const nextChapter = currentIndex < seriesComics.length - 1 ? seriesComics[currentIndex + 1] : null;

  const handlePageChange = useCallback(
    (page: number, total: number) => {
      if (page !== lastSavedPage.current) {
        lastSavedPage.current = page;
        updateProgress(comicPath, { currentPage: page, pageCount: total });
      }
    },
    [comicPath]
  );

  const goToChapter = (comic: Comic) => {
    navigate(`/read/${comic.path}`, { replace: true });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  return (
    <div className="h-screen w-screen bg-white dark:bg-black flex flex-col transition-colors">
      {/* Header with chapter nav */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          onClick={() => navigate(`/series/${encodeURIComponent(comic?.series || '')}`)}
          className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm shrink-0"
        >
          <ArrowLeft size={16} /> <span className="hidden sm:inline">{comic?.series || 'Back'}</span>
        </button>

        <div className="flex-1 min-w-0" />

        <button
          onClick={() => prevChapter && goToChapter(prevChapter)}
          disabled={!prevChapter}
          className="flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 shrink-0 px-1.5 sm:px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          title={prevChapter ? `Previous: ${prevChapter.title}` : 'No previous chapter'}
        >
          <ChevronLeft size={14} /> <span className="hidden sm:inline">Prev</span>
        </button>

        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0 truncate max-w-[10rem] sm:max-w-none">
          {comic?.title || comicPath}
        </span>

        <button
          onClick={() => nextChapter && goToChapter(nextChapter)}
          disabled={!nextChapter}
          className="flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 shrink-0 px-1.5 sm:px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          title={nextChapter ? `Next: ${nextChapter.title}` : 'No next chapter'}
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight size={14} />
        </button>

        <div className="flex-1 min-w-0" />

        <span className="hidden sm:block"><ThemeToggle /></span>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-hidden">
        <PdfViewer
          url={getPdfUrl(comicPath)}
          initialPage={comic?.currentPage || 0}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
