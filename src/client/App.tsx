import { Routes, Route } from 'react-router-dom';
import LibraryPage from './pages/LibraryPage';
import SeriesPage from './pages/SeriesPage';
import ReaderPage from './pages/ReaderPage';
import DiscoverPage from './pages/DiscoverPage';
import OfflineIndicator from './components/OfflineIndicator';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/series/:id" element={<SeriesPage />} />
        <Route path="/read/:id/*" element={<ReaderPage />} />
      </Routes>
      <OfflineIndicator />
    </>
  );
}
