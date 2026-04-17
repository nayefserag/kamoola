import { Link } from 'react-router-dom';
import Logo from '@/components/shared/Logo';

function Footer() {
  return (
    <footer className="relative mt-16 border-t border-white/5">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo size={28} showText={true} />

          <nav className="flex items-center gap-6 text-sm text-textSecondary">
            <Link to="/" className="hover:text-textPrimary transition-colors">
              Home
            </Link>
            <Link to="/browse" className="hover:text-textPrimary transition-colors">
              Browse
            </Link>
            <Link to="/search" className="hover:text-textPrimary transition-colors">
              Search
            </Link>
          </nav>

          <p className="text-xs text-textSecondary/60">
            &copy; {new Date().getFullYear()} Kamoola. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
