import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader, Plus, Trash2, Check, Users, BookOpen } from 'lucide-react';
import {
  getBible, updateBible, getSeriesDetail,
  type StoryBible, type BibleCharacter, type GlossaryEntry,
} from '../lib/api';

/**
 * The Bible editor — the admin's control surface for a series' narration
 * canon. Curate the cast (dedupe, fix names, set voices), the glossary, the
 * running recap, and the narrator directive that shapes how future chapters
 * are told. Saved to the per-series bible the narration pipeline reads.
 */

const ROLES = ['main', 'supporting', 'minor'];
const INPUT =
  'w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 ' +
  'dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent';
const LABEL = 'block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1';

export default function BibleEditorPage() {
  const { seriesId = '' } = useParams();
  const navigate = useNavigate();

  const [bible, setBible] = useState<StoryBible | null>(null);
  const [seriesName, setSeriesName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!seriesId) return;
    let cancelled = false;
    setLoading(true);
    getBible(seriesId)
      .then((b) => { if (!cancelled) { setBible(b); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setLoadError((e as Error).message); setLoading(false); } });
    getSeriesDetail(seriesId)
      .then((s) => { if (!cancelled) setSeriesName(s.englishTitle || s.name); })
      .catch(() => { /* the header just falls back to the id */ });
    return () => { cancelled = true; };
  }, [seriesId]);

  // ----- Immutable edit helpers -----
  const patchCharacter = (i: number, patch: Partial<BibleCharacter>) =>
    setBible((b) => b && { ...b, characters: b.characters.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const removeCharacter = (i: number) =>
    setBible((b) => b && { ...b, characters: b.characters.filter((_, idx) => idx !== i) });
  const addCharacter = () =>
    setBible((b) => b && {
      ...b,
      characters: [...b.characters, { name: '', native: null, aliases: [], role: 'supporting', voice: '' }],
    });

  const patchGlossary = (i: number, patch: Partial<GlossaryEntry>) =>
    setBible((b) => b && { ...b, glossary: b.glossary.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) });
  const removeGlossary = (i: number) =>
    setBible((b) => b && { ...b, glossary: b.glossary.filter((_, idx) => idx !== i) });
  const addGlossary = () =>
    setBible((b) => b && { ...b, glossary: [...b.glossary, { term: '', english: '', note: '' }] });

  const handleSave = async () => {
    if (!bible) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const next = await updateBible(seriesId, bible);
      setBible(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header — sticky */}
      <header
        className="sticky top-0 z-30 bg-gray-50/85 dark:bg-gray-950/85 backdrop-blur-md border-b border-gray-200 dark:border-gray-800"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2 flex items-center gap-2">
          <button
            onClick={() => navigate('/admin')}
            aria-label="Back to admin"
            title="Admin"
            className="p-2 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold leading-tight">Story Bible</h1>
            {seriesName && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{seriesName}</p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !bible}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
          >
            {saving ? <Loader size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-32 space-y-6">
        {loading && (
          <div className="flex justify-center py-16"><Loader size={20} className="animate-spin text-accent" /></div>
        )}
        {loadError && !loading && (
          <div className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
            Couldn’t load the bible: {loadError}
          </div>
        )}

        {bible && !loading && (
          <>
            {/* Narrator directive */}
            <section className="bg-surface dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="text-sm font-semibold mb-1">Narrator directive</h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
                Free-text guidance for the narrator’s voice and tone — injected into the
                narration prompt. Applies to the next narration run.
              </p>
              <textarea
                value={bible.narratorDirective}
                onChange={(e) => setBible({ ...bible, narratorDirective: e.target.value })}
                rows={3}
                placeholder="e.g. Tell it with a wry, light touch — this is a comfy isekai, not an epic. Lean into the comedy."
                className={`${INPUT} resize-y`}
              />
            </section>

            {/* Recap */}
            <section className="bg-surface dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="text-sm font-semibold mb-1">Recap — story so far</h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
                A running summary. The pipeline refreshes this each chapter; edit it to correct course.
              </p>
              <textarea
                value={bible.recap}
                onChange={(e) => setBible({ ...bible, recap: e.target.value })}
                rows={4}
                className={`${INPUT} resize-y`}
              />
            </section>

            {/* Characters */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Users size={15} className="text-gray-400" />
                <h2 className="text-sm font-semibold">Characters</h2>
                <span className="text-xs text-gray-400">({bible.characters.length})</span>
                <div className="flex-1" />
                <button
                  onClick={addCharacter}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Plus size={13} /> Add character
                </button>
              </div>
              <div className="space-y-2">
                {bible.characters.length === 0 && (
                  <p className="text-sm text-gray-400 px-1 py-3">No characters yet.</p>
                )}
                {bible.characters.map((c, i) => (
                  <div
                    key={i}
                    className="bg-surface dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px_auto] gap-3">
                      <div>
                        <label className={LABEL}>Name</label>
                        <input
                          value={c.name}
                          onChange={(e) => patchCharacter(i, { name: e.target.value })}
                          placeholder="English name"
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Native name</label>
                        <input
                          value={c.native ?? ''}
                          onChange={(e) => patchCharacter(i, { native: e.target.value })}
                          placeholder="原語名"
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Role</label>
                        <select
                          value={ROLES.includes(c.role) ? c.role : 'supporting'}
                          onChange={(e) => patchCharacter(i, { role: e.target.value })}
                          className={INPUT}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeCharacter(i)}
                          aria-label="Remove character"
                          title="Remove character"
                          className="p-2 rounded-lg text-gray-400 hover:bg-danger/10 hover:text-danger transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className={LABEL}>Aliases (comma-separated)</label>
                        <input
                          value={c.aliases.join(', ')}
                          onChange={(e) => patchCharacter(i, { aliases: e.target.value.split(',').map((a) => a.trim()) })}
                          placeholder="nicknames, titles…"
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Voice — how they speak</label>
                        <input
                          value={c.voice}
                          onChange={(e) => patchCharacter(i, { voice: e.target.value })}
                          placeholder="e.g. wry, clipped, formal"
                          className={INPUT}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Glossary */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={15} className="text-gray-400" />
                <h2 className="text-sm font-semibold">Glossary</h2>
                <span className="text-xs text-gray-400">({bible.glossary.length})</span>
                <div className="flex-1" />
                <button
                  onClick={addGlossary}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Plus size={13} /> Add term
                </button>
              </div>
              <div className="space-y-2">
                {bible.glossary.length === 0 && (
                  <p className="text-sm text-gray-400 px-1 py-3">No glossary terms yet.</p>
                )}
                {bible.glossary.map((g, i) => (
                  <div
                    key={i}
                    className="bg-surface dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-3"
                  >
                    <div>
                      <label className={LABEL}>Term</label>
                      <input
                        value={g.term}
                        onChange={(e) => patchGlossary(i, { term: e.target.value })}
                        placeholder="原語"
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>English</label>
                      <input
                        value={g.english}
                        onChange={(e) => patchGlossary(i, { english: e.target.value })}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Note</label>
                      <input
                        value={g.note}
                        onChange={(e) => patchGlossary(i, { note: e.target.value })}
                        placeholder="what it is"
                        className={INPUT}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => removeGlossary(i)}
                        aria-label="Remove term"
                        title="Remove term"
                        className="p-2 rounded-lg text-gray-400 hover:bg-danger/10 hover:text-danger transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {saveError && (
              <div className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
                Save failed: {saveError}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
