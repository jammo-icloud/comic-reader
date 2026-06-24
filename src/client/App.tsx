import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import LibraryPage from './pages/LibraryPage';
import SeriesPage from './pages/SeriesPage';
import ReaderPage from './pages/ReaderPage';
import DiscoverPage from './pages/DiscoverPage';
import ImportPage from './pages/ImportPage';
import AdminPage from './pages/AdminPage';
import BibleEditorPage from './pages/BibleEditorPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import OfflineIndicator from './components/OfflineIndicator';
import { flushProgressQueue } from './lib/offline';

interface AuthState {
  authenticated: boolean;
  username: string;
  isAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  authenticated: false,
  username: '',
  isAdmin: false,
  loading: true,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, loading } = useAuth();
  if (loading) return null; // or a spinner
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [auth, setAuth] = useState<{ authenticated: boolean; username: string; isAdmin: boolean; loading: boolean }>({
    authenticated: false,
    username: '',
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    fetch('/api/auth/check')
      .then((r) => r.json())
      .then((data) => {
        setAuth({
          authenticated: !!data.authenticated,
          username: data.username || '',
          isAdmin: !!data.isAdmin,
          loading: false,
        });
      })
      .catch(() => {
        setAuth((prev) => ({ ...prev, loading: false }));
      });
  }, []);

  // Flush any reading-progress writes that were queued while offline — once on
  // load (covers a reload after the network came back) and whenever we
  // reconnect. Only meaningful when authenticated; the server rejects anonymous
  // writes anyway, so they'd just stay queued until login.
  useEffect(() => {
    if (!auth.authenticated) return;
    flushProgressQueue();
    const onOnline = () => { flushProgressQueue(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [auth.authenticated]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuth({ authenticated: false, username: '', isAdmin: false, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...auth, logout }}>
      <Routes>
        <Route path="/login" element={
          auth.authenticated ? <Navigate to="/" replace /> : <LoginPage />
        } />
        <Route path="/" element={<AuthGuard><LibraryPage /></AuthGuard>} />
        <Route path="/import" element={<AuthGuard><ImportPage /></AuthGuard>} />
        <Route path="/discover" element={<AuthGuard><DiscoverPage /></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
        <Route path="/admin" element={<AuthGuard><AdminPage /></AuthGuard>} />
        <Route path="/admin/bible/:seriesId" element={<AuthGuard><BibleEditorPage /></AuthGuard>} />
        <Route path="/series/:id" element={<AuthGuard><SeriesPage /></AuthGuard>} />
        <Route path="/read/:id/*" element={<AuthGuard><ReaderPage /></AuthGuard>} />
      </Routes>
      <OfflineIndicator />
    </AuthContext.Provider>
  );
}
