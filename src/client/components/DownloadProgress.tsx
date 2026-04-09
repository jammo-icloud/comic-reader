import { useState, useEffect, useRef } from 'react';
import { Download, Check, AlertCircle, X, Loader } from 'lucide-react';
import { getDownloadQueue } from '../lib/api';

interface DownloadJob {
  id: string;
  mangaTitle: string;
  status: 'queued' | 'downloading' | 'complete' | 'error';
  progress: { current: number; total: number; currentChapter: string | null; pagesDownloaded: number; pagesTotal: number };
  error?: string;
}

export default function DownloadProgress() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial load
  useEffect(() => {
    getDownloadQueue().then(setJobs).catch(() => {});
  }, []);

  // SSE for real-time updates
  useEffect(() => {
    const es = new EventSource('/api/discover/progress');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const updatedJob: DownloadJob = JSON.parse(event.data);
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === updatedJob.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedJob;
          return next;
        }
        return [...prev, updatedJob];
      });
    };

    return () => es.close();
  }, []);

  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'downloading');
  const completedJobs = jobs.filter((j) => j.status === 'complete');
  const errorJobs = jobs.filter((j) => j.status === 'error');

  if (jobs.length === 0) return null;

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Download size={13} />
          Downloads {activeJobs.length > 0 && `(${activeJobs.length} active)`}
        </h3>

        {activeJobs.map((job) => (
          <div key={job.id} className="flex items-center gap-3 text-sm">
            <Loader size={14} className="animate-spin text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate">{job.mangaTitle}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">
                Ch. {job.progress.currentChapter || '...'} — {job.progress.current}/{job.progress.total} chapters
              </span>
              {job.progress.pagesTotal > 0 && (
                <span className="text-gray-400 dark:text-gray-500 ml-1">
                  ({job.progress.pagesDownloaded}/{job.progress.pagesTotal} pages)
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}

        {completedJobs.map((job) => (
          <div key={job.id} className="flex items-center gap-3 text-sm text-green-600 dark:text-green-400">
            <Check size={14} className="shrink-0" />
            <span>{job.mangaTitle}</span>
            <span className="text-xs text-gray-400">— {job.progress.total} chapters</span>
          </div>
        ))}

        {errorJobs.map((job) => (
          <div key={job.id} className="flex items-center gap-3 text-sm text-red-500">
            <AlertCircle size={14} className="shrink-0" />
            <span>{job.mangaTitle}</span>
            <span className="text-xs">{job.error}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
