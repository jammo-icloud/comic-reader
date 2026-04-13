import { useState, useRef, useEffect } from 'react';
import { Loader, AlertCircle, ShieldCheck } from 'lucide-react';

function useVersion() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    fetch('/api/auth/version').then((r) => r.json()).then((d) => setVersion(d.version)).catch(() => {});
  }, []);
  return version;
}

export default function LoginPage() {
  const version = useVersion();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otpRequired) otpRef.current?.focus();
  }, [otpRequired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    if (otpRequired && !otpCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          ...(otpRequired ? { otpCode: otpCode.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (data.otpRequired) {
        setOtpRequired(true);
        return;
      }

      if (!res.ok || !data.ok) {
        setError(data.error || 'Invalid credentials');
        if (otpRequired) setOtpCode('');
        return;
      }

      window.location.href = '/';
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="/api/auth/login-bg"
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950/80 via-gray-900/70 to-gray-950/90" />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="Comic Reader" className="h-16 w-16 rounded-xl shadow-lg mb-3" />
            <h1 className="text-xl font-bold text-white">Comic Reader</h1>
            <p className="text-xs text-gray-400 mt-1">Sign in with your NAS account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoFocus={!otpRequired}
                autoComplete="username"
                disabled={otpRequired}
                className="w-full px-4 py-3 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                disabled={otpRequired}
                className="w-full px-4 py-3 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 transition-all disabled:opacity-50"
              />
            </div>

            {otpRequired && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={14} className="text-blue-400" />
                  <span className="text-xs text-blue-400">Two-factor authentication</span>
                </div>
                <input
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  className="w-full px-4 py-3 text-sm bg-white/5 border border-blue-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-center text-lg tracking-widest font-mono"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim() || (otpRequired && !otpCode.trim())}
              className="w-full py-3 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-40 disabled:hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : null}
              {loading ? 'Signing in...' : otpRequired ? 'Verify' : 'Sign In'}
            </button>

            {otpRequired && (
              <button
                type="button"
                onClick={() => { setOtpRequired(false); setOtpCode(''); setError(''); }}
                className="w-full text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                Back to login
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-4">
          Synology NAS Authentication {version && `· v${version}`}
        </p>
      </div>
    </div>
  );
}
