import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

function Footer() {
  return (
    <footer className="bg-surface border-t border-gray-800 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            <span className="text-textPrimary font-semibold">Kamoola</span>
          </div>

          <nav className="flex items-center gap-6 text-sm text-textSecondary">
            <Link to="/" className="hover:text-textPrimary transition-colors">
              Home
            </Link>
            <Link to="/browse" className="hover:text-textPrimary transition-colors">
              Browse
            </Link>
          </nav>

          <p className="text-xs text-textSecondary">
            &copy; {new Date().getFullYear()} Kamoola. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
