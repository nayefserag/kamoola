import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight, TrendingUp, Clock, ArrowRight, Flame } from 'lucide-react';
import { usePopularManga, useLatestManga } from '@/hooks/useMangaQueries';
import MangaCard from '@/components/manga/MangaCard';
import MangaGrid from '@/components/manga/MangaGrid';
import SkeletonCard from '@/components/shared/SkeletonCard';

const heroVariants: Variants = {
  hidden: { opacity: 0, y: 36 },
  show:   { opacity: 1, y: 0 },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

function SectionHeader({
  icon: Icon,
  title,
  href,
}: {
  icon: React.ElementType;
  title: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-7">
      <div className="flex items-center gap-3">
        <span className="w-1 h-7 rounded-full bg-accent block shrink-0" />
        <h2 className="text-xl sm:text-2xl font-bold text-textPrimary flex items-center gap-2">
          <Icon className="w-5 h-5 text-accent" />
          {title}
        </h2>
      </div>
      {href && (
        <Link
          to={href}
          className="text-sm text-accent hover:text-accent/80 transition-colors flex items-center gap-1 group"
        >
          View all
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}

function HomePage() {
  const { data: popularManga, isLoading: popularLoading } = usePopularManga(15);
  const { data: latestManga, isLoading: latestLoading } = useLatestManga(18);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };

  return (
    <div>
      {/* ── Hero ───────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden">
        {/* Dot grid background */}
        <div className="absolute inset-0 dot-grid" />

        {/* Atmospheric orbs */}
        <div className="absolute -top-32 right-0 w-[700px] h-[700px] bg-accent/8 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 w-full">
          <div className="max-w-2xl">
            {/* Badge */}
            <motion.div
              variants={heroVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.05, duration: 0.45, ease: 'easeOut' }}
              className="inline-flex items-center gap-2 glass text-accent text-sm font-medium px-4 py-1.5 rounded-full mb-7 border border-accent/20"
            >
              <Flame className="w-4 h-4" />
              Thousands of titles available
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={heroVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.12, duration: 0.5, ease: 'easeOut' }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-textPrimary"
            >
              Your World of{' '}
              <span className="gradient-text">Manga</span>
              <br />
              Starts Here.
            </motion.h1>

            <motion.p
              variants={heroVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.24, duration: 0.5, ease: 'easeOut' }}
              className="mt-6 text-lg text-textSecondary max-w-lg leading-relaxed"
            >
              Discover thousands of manga from every genre — action, romance,
              fantasy and more. Read free, anytime, anywhere.
            </motion.p>

            <motion.div
              variants={heroVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.38, duration: 0.5, ease: 'easeOut' }}
              className="mt-9 flex flex-wrap gap-4"
            >
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/browse"
                  className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-accent/90 transition-colors shadow-glow"
                >
                  Start Browsing
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link
                  to="/search"
                  className="inline-flex items-center gap-2 glass text-textPrimary font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Search Manga
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ── Popular Manga ───────────────────────────── */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      >
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <span className="w-1 h-7 rounded-full bg-accent block shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold text-textPrimary flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Popular Manga
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => scroll('left')}
              className="p-2 rounded-lg glass text-textSecondary hover:text-textPrimary transition-colors"
              whileTap={{ scale: 0.9 }}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={() => scroll('right')}
              className="p-2 rounded-lg glass text-textSecondary hover:text-textPrimary transition-colors"
              whileTap={{ scale: 0.9 }}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        <div ref={scrollRef} className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
          {popularLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[150px] sm:w-[170px]">
                  <SkeletonCard />
                </div>
              ))
            : popularManga?.map((manga) => (
                <div key={manga._id} className="shrink-0 w-[150px] sm:w-[170px]">
                  <MangaCard manga={manga} />
                </div>
              ))}
        </div>
      </motion.section>

      {/* ── Latest Updates ──────────────────────────── */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      >
        <SectionHeader icon={Clock} title="Latest Updates" href="/browse?sort=latest" />
        <MangaGrid manga={latestManga || []} loading={latestLoading} skeletonCount={18} />
      </motion.section>

      {/* ── CTA Banner ──────────────────────────────── */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20"
      >
        <div className="relative overflow-hidden rounded-2xl bg-surface-2 border border-white/5 p-10 sm:p-14 text-center">
          {/* Inner orb */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] bg-accent/8 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-textPrimary mb-3 tracking-tight">
              Ready to explore more?
            </h2>
            <p className="text-textSecondary mb-8 max-w-md mx-auto text-base">
              Browse the full collection with genre filters, sorting options, and hundreds of titles.
            </p>
            <motion.div className="inline-block" whileTap={{ scale: 0.97 }}>
              <Link
                to="/browse"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-9 py-3.5 rounded-xl transition-colors shadow-glow"
              >
                Browse All Manga
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

export default HomePage;
