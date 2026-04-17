import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight, TrendingUp, Clock, ArrowRight } from 'lucide-react';
import { usePopularManga, useLatestManga } from '@/hooks/useMangaQueries';
import MangaCard from '@/components/manga/MangaCard';
import MangaGrid from '@/components/manga/MangaGrid';
import SkeletonCard from '@/components/shared/SkeletonCard';

const heroVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

function HomePage() {
  const { data: popularManga, isLoading: popularLoading } = usePopularManga(15);
  const { data: latestManga, isLoading: latestLoading } = useLatestManga(18);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl">
            <motion.h1
              variants={heroVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-textPrimary leading-tight"
            >
              Explore the World of{' '}
              <span className="text-accent">Manga</span>
            </motion.h1>
            <motion.p
              variants={heroVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.25, duration: 0.5, ease: 'easeOut' }}
              className="mt-4 text-lg text-textSecondary max-w-lg"
            >
              Discover thousands of manga titles from various genres. Read your
              favorites anytime, anywhere.
            </motion.p>
            <motion.div
              variants={heroVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/browse"
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  Start Browsing
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/search"
                  className="inline-flex items-center gap-2 bg-surface hover:bg-white/10 text-textPrimary font-semibold px-6 py-3 rounded-lg border border-gray-700 transition-colors"
                >
                  Search Manga
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Popular Manga - Horizontal Scroll */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-textPrimary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            Popular Manga
          </h2>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => scroll('left')}
              className="p-2 rounded-lg bg-surface hover:bg-white/10 text-textSecondary hover:text-textPrimary transition-colors"
              whileTap={{ scale: 0.9 }}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={() => scroll('right')}
              className="p-2 rounded-lg bg-surface hover:bg-white/10 text-textSecondary hover:text-textPrimary transition-colors"
              whileTap={{ scale: 0.9 }}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto hide-scrollbar pb-2"
        >
          {popularLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[160px] sm:w-[180px]">
                  <SkeletonCard />
                </div>
              ))
            : popularManga?.map((manga) => (
                <div key={manga._id} className="shrink-0 w-[160px] sm:w-[180px]">
                  <MangaCard manga={manga} />
                </div>
              ))}
        </div>
      </motion.section>

      {/* Latest Updates - Grid */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-textPrimary flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Latest Updates
          </h2>
          <Link
            to="/browse?sort=latest"
            className="text-sm text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <MangaGrid
          manga={latestManga || []}
          loading={latestLoading}
          skeletonCount={18}
        />
      </motion.section>

      {/* Browse All CTA */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-16"
      >
        <div className="bg-surface rounded-2xl p-8 sm:p-12 text-center border border-gray-800">
          <h2 className="text-2xl sm:text-3xl font-bold text-textPrimary mb-3">
            Ready to explore more?
          </h2>
          <p className="text-textSecondary mb-6 max-w-md mx-auto">
            Browse our full collection with genre filters, sorting, and more.
          </p>
          <motion.div className="inline-block" whileTap={{ scale: 0.97 }}>
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Browse All Manga
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}

export default HomePage;
