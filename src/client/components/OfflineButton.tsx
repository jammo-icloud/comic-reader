import { useState } from 'react';
import { Download, CheckCircle, Loader } from 'lucide-react';
import type { Comic } from '../lib/types';
import { getPdfUrl, getThumbnailUrl } from '../lib/api';

interface OfflineButtonProps {
  comics: Comic[];
  label?: string;
}

async function isCached(url: string): Promise<boolean> {
  const cache = await caches.open('pdf-cache');
  const match = await cache.match(url);
  return !!match;
}

async function cacheUrl(url: string, onProgress?: () => void): Promise<void> {
  const cache = await caches.open('pdf-cache');
  const existing = await cache.match(url);
  if (existing) {
    onProgress?.();
    return;
  }
  const response = await fetch(url);
  if (response.ok) {
    await cache.put(url, response);
  }
  onProgress?.();
}

export default function OfflineButton({ comics, label = 'Save offline' }: OfflineButtonProps) {
  const [state, setState] = useState<'idle' | 'downloading' | 'done'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Check if caches API is available
  if (typeof caches === 'undefined') return null;

  const handleDownload = async () => {
    setState('downloading');
    const total = comics.length;
    let current = 0;
    setProgress({ current: 0, total });

    for (const comic of comics) {
      try {
        await cacheUrl(getPdfUrl(comic.path), () => {
          current++;
          setProgress({ current, total });
        });
      } catch {
        current++;
        setProgress({ current, total });
      }
    }

    setState('done');
    setTimeout(() => setState('idle'), 3000);
  };

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircle size={14} /> Saved offline
      </span>
    );
  }

  if (state === 'downloading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
        <Loader size={14} className="animate-spin" />
        {progress.current}/{progress.total}
      </span>
    );
  }

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      title={`Download ${comics.length} chapters for offline reading`}
    >
      <Download size={14} /> {label}
    </button>
  );
}
