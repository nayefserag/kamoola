import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import HomePage from '@/pages/HomePage';
import BrowsePage from '@/pages/BrowsePage';
import MangaDetailPage from '@/pages/MangaDetailPage';
import ReaderPage from '@/pages/ReaderPage';
import SearchResultsPage from '@/pages/SearchResultsPage';

function App() {
  return (
    <Routes>
      {/* Reader page - fullscreen, no layout wrapper */}
      <Route path="/manga/:mangaId/read/:chapterId" element={<ReaderPage />} />

      {/* All other pages with layout */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/manga/:id" element={<MangaDetailPage />} />
        <Route path="/search" element={<SearchResultsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
