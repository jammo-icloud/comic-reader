import { useState, useEffect, useRef } from 'react';
import { Download, Check, AlertCircle, X, Loader, Square } from 'lucide-react';
import { getDownloadQueue, cancelDownload, removeDownloadJob } from '../lib/api';

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

  useEffect(() => {
    getDownloadQueue().then(setJobs).catch(() => {});
  }, []);

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

  const handleCancel = async (id: string) => {
    try {
      await cancelDownload(id);
    } catch { /* already handled via SSE update */ }
  };

  const handleDismiss = async (id: string) => {
    await removeDownloadJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'downloading');
  const doneJobs = jobs.filter((j) => j.status === 'complete' || j.status === 'error');

  if (jobs.length === 0) return null;

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Download size={13} />
          Downloads {activeJobs.length > 0 && `(${activeJobs.length} active)`}
        </h3>

        {activeJobs.map((job) => (
          <div key={job.id} className="flex items-center gap-3 text-sm">
            <Loader size={14} className="animate-spin text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate">{job.mangaTitle}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">
                Ch. {job.progress.currentChapter || '...'} — {job.progress.current}/{job.progress.total}
              </span>
              {job.progress.pagesTotal > 0 && (
                <span className="text-gray-400 dark:text-gray-500 ml-1">
                  ({job.progress.pagesDownloaded}/{job.progress.pagesTotal} pg)
                </span>
              )}
            </div>
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0}%` }}
              />
            </div>
            <button
              onClick={() => handleCancel(job.id)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-danger transition-colors shrink-0"
              title="Cancel download"
            >
              <Square size={14} />
            </button>
          </div>
        ))}

        {doneJobs.map((job) => (
          <div key={job.id} className="flex items-center gap-3 text-sm">
            {job.status === 'complete' ? (
              <Check size={14} className="text-success shrink-0" />
            ) : (
              <AlertCircle size={14} className="text-danger shrink-0" />
            )}
            <span className={job.status === 'complete' ? 'text-success' : 'text-danger'}>
              {job.mangaTitle}
            </span>
            <span className="text-xs text-gray-400">
              {job.status === 'complete' ? `${job.progress.total} ch.` : job.error}
            </span>
            <button
              onClick={() => handleDismiss(job.id)}
              className="ml-auto p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
