import { Routes, Route } from 'react-router-dom';
import LibraryPage from './pages/LibraryPage';
import SeriesPage from './pages/SeriesPage';
import ReaderPage from './pages/ReaderPage';
import OfflineIndicator from './components/OfflineIndicator';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/series/:name" element={<SeriesPage />} />
        <Route path="/read/*" element={<ReaderPage />} />
      </Routes>
      <OfflineIndicator />
    </>
  );
}
