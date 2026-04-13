import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader, Check, AlertCircle, X, Square, ChevronRight } from 'lucide-react';
import { getImportCount, getDownloadQueue, cancelDownload, removeDownloadJob, getSeriesCoverUrl, getPlaceholderUrl } from '../lib/api';

interface DownloadJob {
  id: string;
  mangaDexId: string;
  mangaTitle: string;
  status: 'queued' | 'downloading' | 'complete' | 'error';
  progress: { current: number; total: number; currentChapter: string | null; pagesDownloaded: number; pagesTotal: number };
  error?: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial state
  useEffect(() => {
    getImportCount().then((r) => setPendingCount(r.count)).catch(() => {});
    getDownloadQueue().then(setJobs).catch(() => {});
  }, []);

  // Poll pending count
  useEffect(() => {
    const interval = setInterval(async () => {
      const { count } = await getImportCount().catch(() => ({ count: 0 }));
      setPendingCount(count);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // SSE for download progress
  useEffect(() => {
    const es = new EventSource('/api/discover/progress');
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      const updated: DownloadJob = JSON.parse(event.data);
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === updated.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    };
    return () => es.close();
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleCancel = async (id: string) => {
    await cancelDownload(id).catch(() => {});
  };

  const handleDismiss = async (id: string) => {
    await removeDownloadJob(id).catch(() => {});
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'downloading');
  const doneJobs = jobs.filter((j) => j.status === 'complete' || j.status === 'error');
  const badgeCount = pendingCount + activeJobs.length;
  const hasContent = pendingCount > 0 || jobs.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-lg transition-colors ${
          activeJobs.length > 0
            ? 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30'
            : badgeCount > 0
              ? 'text-amber-600 dark:text-amber-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
        }`}
        title="Notifications"
      >
        <Zap size={18} className={activeJobs.length > 0 ? 'animate-pulse' : ''} />
        {badgeCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 ${
            activeJobs.length > 0 ? 'bg-blue-500' : 'bg-amber-500'
          }`}>
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-14 sm:top-full sm:mt-1 sm:w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {!hasContent && (
            <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No notifications
            </div>
          )}

          {/* Pending imports */}
          {pendingCount > 0 && (
            <button
              onClick={() => { setOpen(false); navigate('/import'); }}
              className="flex items-center justify-between w-full px-4 py-3 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors border-b border-gray-200 dark:border-gray-800"
            >
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {pendingCount} pending import{pendingCount !== 1 ? 's' : ''}
              </span>
              <ChevronRight size={16} className="text-amber-500" />
            </button>
          )}

          {/* Download jobs */}
          {activeJobs.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {activeJobs.map((job) => {
                const slug = slugify(job.mangaTitle);
                const pct = job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0;
                return (
                  <div key={job.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-14 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                      <img
                        src={getSeriesCoverUrl(slug)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholderUrl('manga.png'); }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{job.mangaTitle}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {job.status === 'queued' ? 'Queued...' : `Ch. ${job.progress.currentChapter || '...'} — ${job.progress.current}/${job.progress.total}`}
                      </p>
                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      title="Cancel"
                    >
                      <Square size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed / errored jobs */}
          {doneJobs.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {doneJobs.map((job) => (
                <div key={job.id} className="flex items-center gap-3 px-4 py-2.5">
                  {job.status === 'complete' ? (
                    <Check size={14} className="text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{job.mangaTitle}</p>
                    <p className="text-[10px] text-gray-400">
                      {job.status === 'complete' ? `${job.progress.total} chapters` : job.error}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismiss(job.id)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
                    title="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
