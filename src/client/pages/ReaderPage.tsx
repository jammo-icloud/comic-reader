import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Languages } from 'lucide-react';
import { getPdfUrl, updateProgress, getComics, getSeriesDetail } from '../lib/api';
import PdfViewer from '../components/PdfViewer';
import ThemeToggle from '../components/ThemeToggle';
import TranslationDrawer from '../components/TranslationDrawer';
import type { Comic, Series } from '../lib/types';

export default function ReaderPage() {
  const params = useParams();
  const navigate = useNavigate();
  const seriesId = params.id || '';
  // Everything after /read/:id/ is the filename
  const file = params['*'] || '';

  const [series, setSeries] = useState<Series | null>(null);
  const [comics, setComics] = useState<Comic[]>([]);
  const lastSavedPage = useRef(-1);
  const [currentPage, setCurrentPage] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    if (!seriesId) return;
    getSeriesDetail(seriesId).then(setSeries);
    getComics(seriesId).then(setComics);
  }, [seriesId]);

  const currentIndex = useMemo(
    () => comics.findIndex((c) => c.file === file),
    [comics, file]
  );
  const prevChapter = currentIndex > 0 ? comics[currentIndex - 1] : null;
  const nextChapter = currentIndex < comics.length - 1 ? comics[currentIndex + 1] : null;
  const currentComic = currentIndex >= 0 ? comics[currentIndex] : null;

  const handlePageChange = useCallback(
    (page: number, total: number) => {
      setCurrentPage(page);
      if (page !== lastSavedPage.current) {
        lastSavedPage.current = page;
        updateProgress(seriesId, file, { currentPage: page, pageCount: total });
      }
    },
    [seriesId, file]
  );

  // Reset saved-page tracker when chapter changes
  useEffect(() => {
    lastSavedPage.current = -1;
  }, [file]);

  const goToChapter = (comic: Comic) => {
    navigate(`/read/${seriesId}/${comic.file}`, { replace: true });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(`/series/${seriesId}`);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, seriesId]);

  return (
    <div className="h-screen w-screen bg-white dark:bg-black flex flex-col transition-colors">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          onClick={() => navigate(`/series/${seriesId}`)}
          className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm shrink-0"
        >
          <ArrowLeft size={16} /> <span className="hidden sm:inline">{series?.name || 'Back'}</span>
        </button>

        <div className="flex-1 min-w-0" />

        <button
          onClick={() => prevChapter && goToChapter(prevChapter)}
          disabled={!prevChapter}
          className="flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 shrink-0 px-1.5 sm:px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft size={14} /> <span className="hidden sm:inline">Prev</span>
        </button>

        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0 truncate max-w-[10rem] sm:max-w-none">
          {file.replace('.pdf', '')}
        </span>

        <button
          onClick={() => nextChapter && goToChapter(nextChapter)}
          disabled={!nextChapter}
          className="flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 shrink-0 px-1.5 sm:px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight size={14} />
        </button>

        <div className="flex-1 min-w-0" />
        <button
          onClick={() => setShowTranslation((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors shrink-0 ${
            showTranslation
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          title="Translate page"
        >
          <Languages size={14} /> <span className="hidden sm:inline">Translate</span>
        </button>
        <span className="hidden sm:block"><ThemeToggle /></span>
      </div>

      <div className="flex-1 overflow-hidden">
        <PdfViewer
          url={getPdfUrl(seriesId, file)}
          initialPage={currentComic?.currentPage || 0}
          onPageChange={handlePageChange}
        />
      </div>

      <TranslationDrawer
        seriesId={seriesId}
        file={file}
        pageNum={currentPage}
        open={showTranslation}
        onClose={() => setShowTranslation(false)}
      />
    </div>
  );
}
