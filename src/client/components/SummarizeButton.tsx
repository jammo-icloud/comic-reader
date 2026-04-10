import { useState } from 'react';
import { Sparkles, Loader, Check } from 'lucide-react';

const BASE = '/api';

interface SummarizeButtonProps {
  comicKey: string;
  genre?: string;
  onSummary?: (summary: string) => void;
  size?: number;
}

export default function SummarizeButton({ comicKey, genre = 'general', onSummary, size = 14 }: SummarizeButtonProps) {
  const [state, setState] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state === 'processing') return;

    setState('processing');
    setProgress('Starting...');

    try {
      // Start OCR
      const res = await fetch(`${BASE}/ocr/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comicKey, genre }),
      });
      const job = await res.json();

      if (job.status === 'complete') {
        // Already cached — fetch result
        const key = Buffer.from(comicKey).toString('base64url');
        // Can't use btoa with non-ASCII, use a simple approach
        const resultRes = await fetch(`${BASE}/ocr/results/${btoa(comicKey).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`);
        if (resultRes.ok) {
          const result = await resultRes.json();
          onSummary?.(result.summary);
          setState('done');
          return;
        }
      }

      // Listen for progress via SSE
      const es = new EventSource(`${BASE}/ocr/progress`);
      es.onmessage = (event) => {
        const update = JSON.parse(event.data);
        if (update.id !== job.id) return;

        if (update.status === 'ocr') {
          setProgress(`OCR: page ${update.progress.currentPage}/${update.progress.totalPages}`);
        } else if (update.status === 'summarizing') {
          setProgress('Summarizing...');
        } else if (update.status === 'complete') {
          es.close();
          setState('done');
          // Fetch the result
          const encodedKey = btoa(comicKey).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          fetch(`${BASE}/ocr/results/${encodedKey}`)
            .then((r) => r.json())
            .then((r) => onSummary?.(r.summary))
            .catch(() => {});
        } else if (update.status === 'error') {
          es.close();
          setState('error');
          setProgress(update.error || 'Failed');
        }
      };
    } catch (err) {
      setState('error');
      setProgress('OCR service unavailable');
    }
  };

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <Check size={size} /> Summarized
      </span>
    );
  }

  if (state === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
        <Loader size={size} className="animate-spin" />
        {progress}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-400 transition-colors"
        title="Retry summarization"
      >
        <Sparkles size={size} /> {progress || 'Failed — retry'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
      title="Generate AI summary (OCR + LLM)"
    >
      <Sparkles size={size} />
    </button>
  );
}
