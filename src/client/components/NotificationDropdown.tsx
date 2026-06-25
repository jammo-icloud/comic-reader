import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, AlertCircle, X, Square, ChevronRight, BookOpen } from 'lucide-react';
import { getImportCount, getDownloadQueue, cancelDownload, removeDownloadJob, getSeriesCoverUrl, getPlaceholderUrl, getSubscriptionsWithNew, dismissNewChapter, dismissAllNewChapters } from '../lib/api';
import { ProgressBar } from './ds';

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

interface NewChapterItem {
  id: string;
  name: string;
  englishTitle: string | null;
  coverFile: string | null;
  newChapterCount: number;
}

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [newChapters, setNewChapters] = useState<NewChapterItem[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial state
  useEffect(() => {
    getImportCount().then((r) => setPendingCount(r.count)).catch(() => {});
    getDownloadQueue().then(setJobs).catch(() => {});
    getSubscriptionsWithNew().then(setNewChapters).catch(() => {});
  }, []);

  // Poll for subscription updates + pending count
  useEffect(() => {
    const interval = setInterval(async () => {
      const { count } = await getImportCount().catch(() => ({ count: 0 }));
      setPendingCount(count);
      const newCh = await getSubscriptionsWithNew().catch(() => []);
      setNewChapters(newCh);
    }, 30000); // every 30s — not critical to be instant
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

  // Close on click outside — popover is portaled, so we need to check both
  // the trigger button AND the popover, since they're no longer DOM siblings.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inPopover = popoverRef.current?.contains(target);
      if (!inTrigger && !inPopover) setOpen(false);
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

  const handleDismissNewChapter = async (seriesId: string) => {
    await dismissNewChapter(seriesId).catch(() => {});
    setNewChapters((prev) => prev.filter((s) => s.id !== seriesId));
  };

  const handleClearAllNewChapters = async () => {
    await dismissAllNewChapters().catch(() => {});
    setNewChapters([]);
  };

  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'downloading');
  const doneJobs = jobs.filter((j) => j.status === 'complete' || j.status === 'error');
  const newChaptersTotal = newChapters.reduce((sum, s) => sum + s.newChapterCount, 0);
  const badgeCount = pendingCount + activeJobs.length + (newChaptersTotal > 0 ? 1 : 0);
  const hasContent = pendingCount > 0 || jobs.length > 0 || newChapters.length > 0;

  return (
    <>
      {/* Bindery NotificationBell — IconButton-sized trigger, small accent dot
          when something needs attention. (Active downloads pulse the dot.) */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="by-icon-btn"
        title="Notifications"
        aria-label="Notifications"
        aria-pressed={open}
      >
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <Bell size={18} />
          {badgeCount > 0 && (
            <span
              className={activeJobs.length > 0 ? 'animate-pulse' : ''}
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: activeJobs.length > 0 ? 'var(--color-accent)' : 'var(--color-warning)',
                boxShadow: '0 0 0 2px var(--bg-page)',
              }}
            />
          )}
        </span>
      </button>

      {/* Portaled to document.body so a backdrop-filter ancestor (e.g. the
          page header) can't trap our `position: fixed` to its box. */}
      {open && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: 56,
            right: 12,
            width: 'min(320px, calc(100vw - 24px))',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-2xl)',
            zIndex: 50,
            overflow: 'hidden',
            maxHeight: '80dvh',
            overflowY: 'auto',
          }}
        >
          {!hasContent && (
            <div
              className="px-4 py-6 text-center text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              No notifications
            </div>
          )}

          {/* Pending imports */}
          {pendingCount > 0 && (
            <button
              onClick={() => { setOpen(false); navigate('/import'); }}
              className="flex items-center justify-between w-full px-4 py-3 transition-colors"
              style={{
                background: 'rgb(var(--warning) / 0.1)',
                borderBottom: '1px solid var(--border-subtle)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--color-warning)' }}>
                {pendingCount} pending import{pendingCount !== 1 ? 's' : ''}
              </span>
              <ChevronRight size={16} style={{ color: 'var(--color-warning)' }} />
            </button>
          )}

          {/* New chapters from subscriptions */}
          {newChapters.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div
                className="flex items-center gap-2 px-4 py-2"
                style={{ background: 'rgb(var(--accent) / 0.1)' }}
              >
                <BookOpen size={13} style={{ color: 'var(--color-accent)' }} />
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {newChaptersTotal} new chapter{newChaptersTotal !== 1 ? 's' : ''} across {newChapters.length} series
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {newChapters.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <button
                      onClick={() => { setOpen(false); navigate(`/series/${s.id}`); }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-8 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                        <img
                          src={getSeriesCoverUrl(s.id, s.coverFile)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholderUrl('manga.png'); }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-[11px] text-accent">+{s.newChapterCount} new</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDismissNewChapter(s.id)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
                      title="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-1.5">
                  {newChapters.length > 5 ? (
                    <span className="text-[10px] text-gray-400">
                      + {newChapters.length - 5} more
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={handleClearAllNewChapters}
                    className="text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-danger transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            </div>
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
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {job.status === 'queued' ? 'Queued...' : `Ch. ${job.progress.currentChapter || '...'} — ${job.progress.current}/${job.progress.total}`}
                      </p>
                      <ProgressBar value={pct} className="mt-1" />
                    </div>
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-danger transition-colors shrink-0"
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
                    <Check size={14} className="text-success shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-danger shrink-0" />
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
        </div>,
        document.body,
      )}
    </>
  );
}
