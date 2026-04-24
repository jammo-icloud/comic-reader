import { useState, useEffect } from 'react';
import { X, Save, Loader, Trash2, ChevronDown, ChevronUp, Upload, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { updateAdminSeries, getAdminSeriesComics, deleteAdminComic, uploadSeriesCover, getSeriesCoverUrl } from '../lib/api';
import SyncSourcePicker from './SyncSourcePicker';

interface SeriesEditModalProps {
  series: {
    id: string;
    name: string;
    englishTitle?: string | null;
    type: string;
    score?: number | null;
    synopsis?: string | null;
    tags?: string[];
    status?: string | null;
    year?: number | null;
    malId?: number | null;
    mangaDexId?: string | null;
    syncSource?: { sourceId: string; mangaId: string } | null;
  };
  onClose: () => void;
  onSave: () => void;
}

interface ComicRecord {
  file: string;
  pages: number;
  order: number;
}

export default function SeriesEditModal({ series, onClose, onSave }: SeriesEditModalProps) {
  // Form state
  const [name, setName] = useState(series.name);
  const [englishTitle, setEnglishTitle] = useState(series.englishTitle || '');
  const [type, setType] = useState(series.type);
  const [score, setScore] = useState(series.score != null ? String(series.score) : '');
  const [synopsis, setSynopsis] = useState(series.synopsis || '');
  const [tags, setTags] = useState((series.tags || []).join(', '));
  const [status, setStatus] = useState(series.status || '');
  const [year, setYear] = useState(series.year != null ? String(series.year) : '');
  const [malId, setMalId] = useState(series.malId != null ? String(series.malId) : '');
  const [mangaDexId, setMangaDexId] = useState(series.mangaDexId || '');

  // Chapters
  const [comics, setComics] = useState<ComicRecord[]>([]);
  const [loadingComics, setLoadingComics] = useState(true);
  const [showChapters, setShowChapters] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  // Cover upload
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverVersion, setCoverVersion] = useState(0); // cache-bust after upload

  // Sync source
  const [syncSource, setSyncSource] = useState(series.syncSource);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAdminSeriesComics(series.id)
      .then(setComics)
      .finally(() => setLoadingComics(false));
  }, [series.id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateAdminSeries(series.id, {
        name: name.trim(),
        englishTitle: englishTitle.trim() || null,
        type,
        score: score ? parseFloat(score) : null,
        synopsis: synopsis.trim() || null,
        tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        status: status || null,
        year: year ? parseInt(year, 10) : null,
        malId: malId ? parseInt(malId, 10) : null,
        mangaDexId: mangaDexId.trim() || null,
      });
      setSaved(true);
      setTimeout(() => { onSave(); }, 300);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComic = async (file: string) => {
    if (!confirm(`Delete "${file}"? This removes the file from disk permanently.`)) return;
    setDeletingFile(file);
    try {
      await deleteAdminComic(series.id, file);
      setComics((prev) => prev.filter((c) => c.file !== file));
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    } finally {
      setDeletingFile(null);
    }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleCoverUpload = async () => {
    if (!coverFile) return;
    setUploadingCover(true);
    setError('');
    try {
      await uploadSeriesCover(series.id, coverFile);
      setCoverFile(null);
      setCoverPreview(null);
      setCoverVersion((v) => v + 1);
    } catch (err) {
      setError(`Cover upload failed: ${(err as Error).message}`);
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-full overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-t-xl">
          <h2 className="text-lg font-semibold flex-1 truncate">Edit: {series.name}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">

          {/* Cover */}
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-24 h-36 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                {coverPreview ? (
                  <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={`${getSeriesCoverUrl(series.id, (series as any).coverFile)}?v=${coverVersion}`}
                    alt="Cover"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {!coverPreview && (
                  <ImageIcon size={24} className="text-gray-300 dark:text-gray-600 absolute" />
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center gap-2">
              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Cover Image</label>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors w-fit">
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                <Upload size={12} /> Choose image
              </label>
              {coverFile && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCoverUpload}
                    disabled={uploadingCover}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                  >
                    {uploadingCover ? <Loader className="animate-spin" size={12} /> : <Save size={12} />}
                    {uploadingCover ? 'Uploading...' : 'Upload'}
                  </button>
                  <button
                    onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <p className="text-[10px] text-gray-400">Resized to 300×450 JPEG automatically.</p>
            </div>
          </div>

          {/* Metadata fields */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={name} onChange={setName} />
            <Field label="English Title" value={englishTitle} onChange={setEnglishTitle} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="comic">Comic</option>
                <option value="magazine">Magazine</option>
              </select>
            </div>
            <Field label="Status" value={status} onChange={setStatus} placeholder="ongoing, completed..." />
            <Field label="Year" value={year} onChange={setYear} type="number" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Score" value={score} onChange={setScore} type="number" placeholder="0-10" />
            <Field label="MAL ID" value={malId} onChange={setMalId} type="number" />
            <Field label="MangaDex ID" value={mangaDexId} onChange={setMangaDexId} />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="manga, action, shounen..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Synopsis</label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Sync Source */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Sync Source</label>
            <div className="flex items-center gap-2 text-sm">
              {syncSource ? (
                <>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                    <RefreshCw size={12} />
                    <span className="capitalize">{syncSource.sourceId}</span>
                    <span className="font-mono text-[10px] text-gray-400">{syncSource.mangaId}</span>
                  </span>
                  <button
                    onClick={() => setShowSourcePicker(true)}
                    className="text-xs text-gray-500 hover:text-blue-500"
                  >
                    Change
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowSourcePicker(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                >
                  <RefreshCw size={12} /> Subscribe to updates
                </button>
              )}
            </div>
          </div>

          {/* Chapters */}
          <div>
            <button
              onClick={() => setShowChapters(!showChapters)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              {showChapters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Chapters ({loadingComics ? '...' : comics.length})
            </button>

            {showChapters && (
              <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {loadingComics ? (
                  <div className="flex justify-center py-4"><Loader className="animate-spin text-gray-400" size={16} /></div>
                ) : comics.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400">No chapters</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                        <th className="px-3 py-1.5 text-left font-medium w-12">#</th>
                        <th className="px-3 py-1.5 text-left font-medium">File</th>
                        <th className="px-3 py-1.5 text-left font-medium w-16">Pages</th>
                        <th className="px-3 py-1.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {comics.map((c) => (
                        <tr key={c.file} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-1.5 text-gray-400 font-mono">{c.order}</td>
                          <td className="px-3 py-1.5 truncate max-w-[250px]">{c.file}</td>
                          <td className="px-3 py-1.5 text-gray-400">{c.pages || '?'}</td>
                          <td className="px-3 py-1.5">
                            <button
                              onClick={() => handleDeleteComic(c.file)}
                              disabled={deletingFile === c.file}
                              className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              title="Delete chapter"
                            >
                              {deletingFile === c.file ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">{error}</div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader className="animate-spin" size={14} /> : saved ? '✓' : <Save size={14} />}
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {showSourcePicker && (
        <SyncSourcePicker
          seriesId={series.id}
          seriesName={name}
          currentSource={syncSource}
          onClose={() => setShowSourcePicker(false)}
          onSaved={(source) => {
            setSyncSource(source);
            setShowSourcePicker(false);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
