import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, ShieldCheck, ShieldOff, Loader } from 'lucide-react';
import { getMe, updatePreferences } from '../lib/api';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [safeMode, setSafeMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMe().then((data) => {
      setTheme(data.preferences.theme);
      setSafeMode(data.preferences.safeMode ?? true);
    }).finally(() => setLoading(false));
  }, []);

  const save = async (updates: { theme?: 'dark' | 'light'; safeMode?: boolean }) => {
    setSaving(true);
    try {
      const result = await updatePreferences(updates);
      setTheme(result.theme);
      setSafeMode(result.safeMode);
      // Apply theme immediately
      if (updates.theme) {
        document.documentElement.classList.toggle('dark', result.theme === 'dark');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader className="animate-spin text-blue-500" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Theme */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold">Appearance</h2>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Choose light or dark mode</p>
              </div>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => save({ theme: 'light' })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    theme === 'light'
                      ? 'bg-white dark:bg-gray-700 shadow-sm font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Sun size={14} /> Light
                </button>
                <button
                  onClick={() => save({ theme: 'dark' })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    theme === 'dark'
                      ? 'bg-white dark:bg-gray-700 shadow-sm font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Moon size={14} /> Dark
                </button>
              </div>
            </div>
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
                onClick={() => save({ safeMode: !safeMode })}
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
              <p className="text-[10px] text-red-400 mt-2 flex items-center gap-1">
                Categories shown: adult, hentai, nsfw, ecchi, mature, nudity, erotica, smut, sexual violence
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
