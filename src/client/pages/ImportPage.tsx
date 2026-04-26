import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen, Upload, Loader, FileText, AlertCircle, Search,
  ChevronDown, ChevronUp, CheckCircle, Zap,
} from 'lucide-react';
import { getWatchFolder, uploadFiles, scanLocalImport, importScan, uploadCrz } from '../lib/api';
import PendingList from '../components/PendingList';
import NotificationDropdown from '../components/NotificationDropdown';
import ProfileMenu from '../components/ProfileMenu';

function formatSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportPage() {
  // Folder scan
  const [folderPath, setFolderPath] = useState('');
  const [scanningFolder, setScanningFolder] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState('');

  // File upload
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Watch folder
  const [watchItems, setWatchItems] = useState<{ name: string; isDirectory: boolean; size: number | null }[]>([]);
  const [watchPath, setWatchPath] = useState('');
  const [loadingWatch, setLoadingWatch] = useState(false);
  const [scanningWatch, setScanningWatch] = useState(false);

  // CRZ import
  const [crzMessage, setCrzMessage] = useState('');

  // Folder-scan card collapse state (demoted, secondary)
  const [showFolderScan, setShowFolderScan] = useState(false);

  // PendingList
  const [showPendingList, setShowPendingList] = useState(false);
  const [pendingMode, setPendingMode] = useState<'local' | 'orchestrator'>('local');

  const loadWatchFolder = useCallback(async () => {
    setLoadingWatch(true);
    try {
      const data = await getWatchFolder();
      setWatchItems(data.items);
      setWatchPath(data.path);
    } catch (err) {
      console.error('Watch folder check failed:', err);
    } finally {
      setLoadingWatch(false);
    }
  }, []);

  useEffect(() => { loadWatchFolder(); }, [loadWatchFolder]);

  // Folder scan (orchestrator path)
  const handleFolderScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPath.trim()) return;
    setScanningFolder(true);
    setScanError('');
    setScanResult(null);
    try {
      await importScan(folderPath.trim());
      setScanResult('Scanning started — items will appear for confirmation shortly.');
      setPendingMode('orchestrator');
      setShowPendingList(true);
    } catch (err) {
      setScanError((err as Error).message);
    } finally {
      setScanningFolder(false);
    }
  };

  const handleFiles = async (files: File[]) => {
    setUploadError('');
    setCrzMessage('');

    const crzFiles = files.filter((f) => f.name.toLowerCase().endsWith('.crz'));
    const otherFiles = files.filter((f) => !f.name.toLowerCase().endsWith('.crz'));

    if (crzFiles.length > 0) {
      setUploading(true);
      try {
        for (const crz of crzFiles) {
          const result = await uploadCrz(crz);
          setCrzMessage(`Imported "${result.title}": ${result.chaptersImported} chapters${result.merged ? ' (merged)' : ''}`);
        }
      } catch (err) {
        setUploadError((err as Error).message);
      } finally {
        setUploading(false);
      }
      if (otherFiles.length === 0) return;
    }

    const validExtensions = ['.pdf', '.cbr', '.cbz'];
    const valid = otherFiles.filter((f) => validExtensions.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (valid.length === 0 && crzFiles.length === 0) {
      setUploadError('No supported files (PDF, CBR, CBZ, CRZ).');
      return;
    }
    if (valid.length === 0) return;
    setUploading(true);
    try {
      await uploadFiles(valid);
      await loadWatchFolder();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);
    e.target.value = '';
  };

  const handleImportWatch = async () => {
    setScanningWatch(true);
    try {
      const result = await scanLocalImport();
      if (result.count > 0) {
        setPendingMode('local');
        setShowPendingList(true);
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanningWatch(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">

      {/* ===== Library-shape header ===== */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5">
          <img src="/logo.png" alt="Comic Reader" className="h-10 w-10 rounded-lg shrink-0" />
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Import</span>
          <div className="flex-1" />
          <NotificationDropdown />
          <ProfileMenu />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* ===== Hero drop zone ===== */}
        <section
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 p-10 sm:p-16 rounded-2xl border-2 border-dashed transition-colors text-center ${
            dragOver
              ? 'border-accent bg-accent/10'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 bg-white/40 dark:bg-gray-900/40'
          }`}
        >
          {uploading ? (
            <Loader size={36} className="animate-spin text-accent" />
          ) : (
            <div className={`p-4 rounded-full ${dragOver ? 'bg-accent/15 text-accent' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>
              <Upload size={32} />
            </div>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-semibold">
              {uploading ? 'Uploading…' : 'Drop files here'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
              PDF · CBR · CBZ · CRZ
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            Browse files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.cbr,.cbz,.crz"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />

          {crzMessage && (
            <p className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mt-1">
              <CheckCircle size={12} /> {crzMessage}
            </p>
          )}
          {uploadError && (
            <p className="inline-flex items-center gap-1.5 text-xs text-red-500 mt-1">
              <AlertCircle size={12} /> {uploadError}
            </p>
          )}
        </section>

        {/* ===== Watch folder ===== */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                Watch folder
                {watchItems.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-accent/15 text-accent rounded-full font-medium">
                    {watchItems.length}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 font-mono mt-0.5 truncate">
                {watchPath || '/library/import'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={loadWatchFolder}
                disabled={loadingWatch}
                className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors min-h-[36px]"
                title="Refresh watch folder"
              >
                {loadingWatch ? <Loader size={14} className="animate-spin" /> : 'Refresh'}
              </button>
              {watchItems.length > 0 && (
                <button
                  onClick={handleImportWatch}
                  disabled={scanningWatch}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-accent hover:bg-accent text-white rounded-lg disabled:opacity-50 transition-colors min-h-[40px] font-medium"
                >
                  {scanningWatch ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
                  Import {watchItems.length}
                </button>
              )}
            </div>
          </div>

          {watchItems.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FolderOpen size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-700" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No files waiting.</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                Drop files above, or copy them directly into the watch folder on your NAS.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
              {watchItems.map((item) => (
                <div key={item.name} className="flex items-center gap-3 px-5 py-2.5">
                  {item.isDirectory ? (
                    <FolderOpen size={14} className="text-amber-500 shrink-0" />
                  ) : (
                    <FileText size={14} className="text-gray-400 shrink-0" />
                  )}
                  <span className="text-sm truncate flex-1">{item.name}</span>
                  {item.size !== null && (
                    <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{formatSize(item.size)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== Scan a NAS folder (collapsed by default — secondary path) ===== */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <button
            onClick={() => setShowFolderScan((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div>
              <h2 className="text-sm font-semibold">Scan a folder on your NAS</h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">
                Each subfolder becomes a series. We'll search MAL for cover art &amp; metadata.
              </p>
            </div>
            {showFolderScan ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
          </button>

          {showFolderScan && (
            <form onSubmit={handleFolderScan} className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="/volume1/Manga/incoming"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent placeholder-gray-400 dark:placeholder-gray-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={scanningFolder || !folderPath.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-accent hover:bg-accent text-white rounded-lg disabled:opacity-50 transition-colors min-h-[40px]"
                >
                  {scanningFolder ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
                  Scan
                </button>
              </div>
              {scanError && (
                <p className="inline-flex items-center gap-1 text-xs text-red-500 mt-2">
                  <AlertCircle size={12} /> {scanError}
                </p>
              )}
              {scanResult && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">{scanResult}</p>
              )}
            </form>
          )}
        </section>

        {/* Helpful footer link to where active imports show up */}
        <p className="text-center text-[11px] text-gray-400 dark:text-gray-600">
          Track in-flight imports in the{' '}
          <Link to="/admin" className="text-accent hover:underline">Admin → Tasks</Link>
          {' '}tab.
        </p>
      </main>

      {/* PendingList modal */}
      {showPendingList && (
        <PendingList
          useLocal={pendingMode === 'local'}
          onClose={() => { setShowPendingList(false); loadWatchFolder(); }}
          onUpdate={() => loadWatchFolder()}
        />
      )}
    </div>
  );
}
