import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader } from 'lucide-react';
import { useEscapeKey } from './useEscapeKey';

export interface PreviewReaderProps {
  pages: string[];
  chapterLabel: string;
  mangaTitle: string;
  loading?: boolean;
  onClose: () => void;
}

export default function PreviewReader({ pages, chapterLabel, mangaTitle, loading, onClose }: PreviewReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => new Set());

  useEscapeKey(onClose);

  // Lock body scroll while reader is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Track which page is in view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || pages.length === 0) return;
    const handleScroll = () => {
      const containerTop = el.scrollTop;
      const containerMid = containerTop + el.clientHeight / 3;
      for (let i = imgRefs.current.length - 1; i >= 0; i--) {
        const ref = imgRefs.current[i];
        if (ref && ref.offsetTop <= containerMid) {
          setCurrentPage(i + 1);
          break;
        }
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [pages.length]);

  const onImageLoad = useCallback((idx: number) => {
    setLoadedSet((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  }, []);

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/90 backdrop-blur-sm shrink-0 z-10">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          aria-label="Close reader"
        >
          <X size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{mangaTitle}</div>
          <div className="text-xs text-gray-400 truncate">{chapterLabel}</div>
        </div>
        {pages.length > 0 && (
          <span className="text-xs text-gray-500 tabular-nums shrink-0">
            {currentPage} / {pages.length}
          </span>
        )}
      </div>

      {/* Scroll container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading && pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader size={24} className="animate-spin text-gray-500" />
            <span className="text-sm text-gray-500">Fetching pages...</span>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No pages available
          </div>
        ) : (
          <div className="max-w-[800px] mx-auto">
            {pages.map((url, i) => (
              <div
                key={i}
                ref={(el) => { imgRefs.current[i] = el; }}
                className="relative w-full"
              >
                {!loadedSet.has(i) && (
                  <div className="flex items-center justify-center py-32 text-gray-600">
                    <Loader size={20} className="animate-spin" />
                  </div>
                )}
                <img
                  src={url}
                  alt={`Page ${i + 1}`}
                  className="w-full block"
                  loading={i < 3 ? 'eager' : 'lazy'}
                  onLoad={() => onImageLoad(i)}
                  onError={() => onImageLoad(i)}
                  style={loadedSet.has(i) ? undefined : { position: 'absolute', top: 0, left: 0, opacity: 0 }}
                />
              </div>
            ))}
            <div className="py-8 text-center text-gray-600 text-sm">
              End of chapter
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
