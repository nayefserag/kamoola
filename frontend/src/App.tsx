import { useLocation, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import HomePage from '@/pages/HomePage';
import BrowsePage from '@/pages/BrowsePage';
import MangaDetailPage from '@/pages/MangaDetailPage';
import ReaderPage from '@/pages/ReaderPage';
import SearchResultsPage from '@/pages/SearchResultsPage';

function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
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
    </AnimatePresence>
  );
}

export default App;
