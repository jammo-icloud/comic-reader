import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Upload, Loader, HardDrive, FileText, AlertCircle, Search } from 'lucide-react';
import { getWatchFolder, uploadFiles, scanLocalImport, importScan, uploadCrz } from '../lib/api';
import PendingList from '../components/PendingList';
import NotificationDropdown from '../components/NotificationDropdown';
import ThemeToggle from '../components/ThemeToggle';

function formatSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportPage() {
  const navigate = useNavigate();

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

  // PendingList
  const [showPendingList, setShowPendingList] = useState(false);
  const [pendingMode, setPendingMode] = useState<'local' | 'orchestrator'>('local');

  // Load watch folder
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

  // Folder scan (orchestrator path — same as old ImportModal)
  const handleFolderScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPath.trim()) return;
    setScanningFolder(true);
    setScanError('');
    setScanResult(null);
    try {
      await importScan(folderPath.trim());
      setScanResult('Scanning started! Items will appear for confirmation shortly.');
      setPendingMode('orchestrator');
      setShowPendingList(true);
    } catch (err) {
      setScanError((err as Error).message);
    } finally {
      setScanningFolder(false);
    }
  };

  // File upload (drag & drop or file picker)
  const handleFiles = async (files: File[]) => {
    // Route .crz files to the CRZ import handler
    const crzFiles = files.filter((f) => f.name.toLowerCase().endsWith('.crz'));
    const otherFiles = files.filter((f) => !f.name.toLowerCase().endsWith('.crz'));

    if (crzFiles.length > 0) {
      setUploading(true);
      setUploadError('');
      setCrzMessage('');
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
      setUploadError('No supported files (PDF, CBR, CBZ, CRZ)');
      return;
    }
    if (valid.length === 0) return;
    setUploading(true);
    setUploadError('');
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

  // Scan watch folder → PendingList
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold flex-1">Import</h1>
          <NotificationDropdown />
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 1. Import from NAS folder */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen size={16} className="text-blue-500" />
              <h2 className="text-sm font-semibold">Import from NAS folder</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Each subfolder becomes a series. The scanner will search MAL for cover art and metadata.
            </p>
          </div>
          <form onSubmit={handleFolderScan} className="px-5 py-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="/volume1/Manga/incoming"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={scanningFolder || !folderPath.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {scanningFolder ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
                Scan
              </button>
            </div>
            {scanError && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
                <AlertCircle size={12} /> {scanError}
              </p>
            )}
            {scanResult && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">{scanResult}</p>
            )}
          </form>
        </section>

        {/* 2. Upload files */}
        <section>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 p-10 rounded-xl border-2 border-dashed transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
          >
            {uploading ? (
              <Loader size={28} className="animate-spin text-blue-500" />
            ) : (
              <Upload size={28} className={dragOver ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'} />
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {uploading ? 'Uploading...' : 'Drag & drop PDF, CBR, CBZ, or CRZ files here'}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-blue-500 hover:text-blue-400 disabled:opacity-50"
            >
              or browse files
            </button>
            {crzMessage && (
              <p className="text-xs text-green-500 mt-1">{crzMessage}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.cbr,.cbz,.crz"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
            {uploadError && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                <AlertCircle size={12} /> {uploadError}
              </p>
            )}
          </div>
        </section>

        {/* 3. NAS Watch Folder */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="text-gray-400" />
              <span className="text-sm font-medium">NAS Import Folder</span>
              {watchItems.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium">
                  {watchItems.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {watchItems.length > 0 && (
                <button
                  onClick={handleImportWatch}
                  disabled={scanningWatch}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {scanningWatch ? <Loader size={12} className="animate-spin" /> : <FolderOpen size={12} />}
                  Import All
                </button>
              )}
              <button
                onClick={loadWatchFolder}
                disabled={loadingWatch}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {loadingWatch ? <Loader size={12} className="animate-spin" /> : 'Refresh'}
              </button>
            </div>
          </div>

          {watchItems.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Drop files into <span className="font-mono text-[10px]">{watchPath || '/library/import'}</span> on your NAS
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1">
                Files uploaded above also appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {watchItems.map((item) => (
                <div key={item.name} className="flex items-center gap-3 px-5 py-2.5">
                  {item.isDirectory ? (
                    <FolderOpen size={14} className="text-amber-500 shrink-0" />
                  ) : (
                    <FileText size={14} className="text-gray-400 shrink-0" />
                  )}
                  <span className="text-sm truncate flex-1">{item.name}</span>
                  {item.size !== null && (
                    <span className="text-[10px] text-gray-400 shrink-0">{formatSize(item.size)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
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
