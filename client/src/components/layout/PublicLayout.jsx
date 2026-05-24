import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import Logo from '../common/Logo';
import ThemeToggle from '../common/ThemeToggle';

const NAV_LINKS = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/docs', label: 'Docs' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
];

export default function PublicLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 font-body">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          <Link to="/"><Logo textClassName="text-xl" /></Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`text-sm font-medium transition-colors ${pathname === l.to ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-gray-600 dark:text-gray-300" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 space-y-3">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400 py-1">
                {l.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-600 dark:text-gray-300 py-1">Sign in</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg text-center">
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
            <div>
              <Logo textClassName="text-xl" className="mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">Virtual phone numbers for instant SMS verification from 1150+ countries.</p>
            </div>
            <div className="flex flex-wrap gap-12">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Product</p>
                <div className="space-y-2">
                  <Link to="/pricing" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Pricing</Link>
                  <Link to="/docs" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Documentation</Link>
                  <Link to="/blog" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Blog</Link>
                  <Link to="/faq" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">FAQ</Link>
                  <Link to="/support" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Support</Link>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Company</p>
                <div className="space-y-2">
                  <Link to="/about" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">About</Link>
                  <Link to="/terms" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Terms of Service</Link>
                  <Link to="/privacy" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Privacy Policy</Link>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Contact</p>
                <div className="space-y-2">
                  <a href="mailto:support@textlix.com" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">support@textlix.com</a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 pt-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">© {new Date().getFullYear()} textlix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
