import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldOff, Loader, Check, Languages, Save } from 'lucide-react';
import { getMe, updatePreferences, getTranslationConfig, updateTranslationConfig, type TranslationConfig } from '../lib/api';
import { useAuth } from '../App';
import { useTheme } from '../lib/theme';
import { THEME_PAIRS, type ThemeDef } from '../lib/themes';

function ThemeSwatch({ theme, active, onClick }: { theme: ThemeDef; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden border-2 transition-all ${
        active
          ? 'border-accent ring-2 ring-accent/30 scale-[1.02]'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {/* Mini preview */}
      <div className="p-2.5 space-y-1.5" style={{ backgroundColor: theme.bg }}>
        {/* Header bar */}
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: theme.accent }} />
          <div className="flex-1" />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.surface }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.surface }} />
        </div>
        {/* Content cards */}
        <div className="flex gap-1">
          <div className="w-6 h-8 rounded" style={{ backgroundColor: theme.surface }} />
          <div className="w-6 h-8 rounded" style={{ backgroundColor: theme.surface }} />
          <div className="w-6 h-8 rounded" style={{ backgroundColor: theme.surface }} />
        </div>
        {/* Text lines */}
        <div className="space-y-0.5">
          <div className="w-12 h-1 rounded-full" style={{ backgroundColor: theme.text, opacity: 0.7 }} />
          <div className="w-8 h-1 rounded-full" style={{ backgroundColor: theme.text, opacity: 0.3 }} />
        </div>
      </div>
      {/* Label */}
      <div className="px-2.5 py-1.5 text-left" style={{ backgroundColor: theme.bg }}>
        <p className="text-[11px] font-medium leading-tight" style={{ color: theme.text }}>{theme.name}</p>
        <p className="text-[9px] leading-tight" style={{ color: theme.text, opacity: 0.5 }}>{theme.description}</p>
      </div>
      {/* Active check */}
      {active && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.accent }}>
          <Check size={12} color={theme.bg} strokeWidth={3} />
        </div>
      )}
    </button>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { theme: currentTheme, setTheme } = useTheme();
  const [safeMode, setSafeMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Translation config (admin only)
  const [transConfig, setTransConfig] = useState<TranslationConfig | null>(null);
  const [savingTrans, setSavingTrans] = useState(false);
  const [transMsg, setTransMsg] = useState('');

  useEffect(() => {
    getMe().then((data) => {
      setSafeMode(data.preferences.safeMode ?? true);
    }).finally(() => setLoading(false));

    if (isAdmin) {
      getTranslationConfig().then(setTransConfig).catch(() => {});
    }
  }, [isAdmin]);

  const saveSafeMode = async (value: boolean) => {
    setSaving(true);
    try {
      const result = await updatePreferences({ safeMode: value });
      setSafeMode(result.safeMode);
    } finally {
      setSaving(false);
    }
  };

  const saveTransConfig = async () => {
    if (!transConfig) return;
    setSavingTrans(true);
    setTransMsg('');
    try {
      const updated = await updateTranslationConfig(transConfig);
      setTransConfig(updated);
      setTransMsg('Saved.');
      setTimeout(() => setTransMsg(''), 2000);
    } catch (err) {
      setTransMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSavingTrans(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader className="animate-spin text-accent" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Theme Picker */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold">Theme</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Choose your reading atmosphere</p>
          </div>
          <div className="p-4 space-y-4">
            {THEME_PAIRS.map(([dark, light]) => (
              <div key={dark.id} className="grid grid-cols-2 gap-3">
                <ThemeSwatch
                  theme={dark}
                  active={currentTheme === dark.id}
                  onClick={() => setTheme(dark.id)}
                />
                <ThemeSwatch
                  theme={light}
                  active={currentTheme === light.id}
                  onClick={() => setTheme(light.id)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Safe Mode */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold">Content Filtering</h2>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  {safeMode ? <ShieldCheck size={16} className="text-green-500" /> : <ShieldOff size={16} className="text-red-400" />}
                  Safe Mode
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {safeMode
                    ? 'Adult content is hidden from your library and search results.'
                    : 'All content is visible, including adult/NSFW series.'}
                </p>
              </div>
              <button
                onClick={() => saveSafeMode(!safeMode)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  safeMode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                    safeMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {!safeMode && (
              <p className="text-[10px] text-red-400 mt-2">
                Categories shown: adult, hentai, nsfw, ecchi, mature, nudity, erotica, smut, sexual violence
              </p>
            )}
          </div>
        </section>

        {/* Translation (admin only) */}
        {isAdmin && transConfig && (
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Languages size={14} /> Translation (Admin)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Configure an Ollama server running a vision-capable model (e.g. Qwen2.5-VL).
                Leave URL blank to disable the Translate feature.
              </p>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Ollama URL
                </label>
                <input
                  type="text"
                  value={transConfig.url}
                  onChange={(e) => setTransConfig({ ...transConfig, url: e.target.value })}
                  placeholder="http://5090-box.local:11434"
                  className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={transConfig.model}
                  onChange={(e) => setTransConfig({ ...transConfig, model: e.target.value })}
                  placeholder="qwen2.5vl:7b"
                  className="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Suggested: <code>qwen2.5vl:7b</code> (fast) or <code>qwen2.5vl:32b</code> (higher quality)
                </p>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Prompt (advanced)
                </label>
                <textarea
                  value={transConfig.prompt}
                  onChange={(e) => setTransConfig({ ...transConfig, prompt: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveTransConfig}
                  disabled={savingTrans}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  {savingTrans ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
                {transMsg && (
                  <span className={`text-xs ${transMsg.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                    {transMsg}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
