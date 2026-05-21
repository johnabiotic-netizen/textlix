import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiSettings } from 'react-icons/fi';
import { RiCoinLine } from 'react-icons/ri';
import useAuthStore from '../../store/authStore';
import { logout as logoutApi } from '../../api/auth';
import toast from 'react-hot-toast';
import Logo from '../common/Logo';
import ThemeToggle from '../common/ThemeToggle';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const navLink = (path) =>
    `text-sm font-medium transition-colors ${location.pathname === path
      ? 'text-brand-600 dark:text-brand-400'
      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`;
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try { await logoutApi(); } catch (_) {}
    logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/dashboard">
            <Logo textClassName="text-lg" />
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link to="/dashboard" className={navLink('/dashboard')}>Dashboard</Link>
            <Link to="/numbers" className={navLink('/numbers')}>Get Number</Link>
            <Link to="/numbers/active" className={navLink('/numbers/active')}>Active</Link>
            <Link to="/orders" className={navLink('/orders')}>History</Link>
            <Link to="/credits" className={navLink('/credits')}>Buy Credits</Link>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <Link to="/credits" className="hidden md:flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-amber-100 transition-colors relative">
              <RiCoinLine size={16} className="text-credit" />
              {user?.creditBalance?.toLocaleString() ?? '0'}
              {(user?.creditBalance ?? 0) < 100 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
              )}
            </Link>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-1.5 transition-colors"
              >
                {user?.avatar ? (
                  <img src={user.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-semibold">
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                )}
              </button>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                    <div className="p-1">
                      <Link to="/settings" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                        <FiSettings size={15} /> Settings
                      </Link>
                      <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg w-full">
                        <FiLogOut size={15} /> Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button className="md:hidden text-gray-600 dark:text-gray-400" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-2 bg-white dark:bg-gray-900">
          <Link to="/dashboard" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          <Link to="/numbers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Get Number</Link>
          <Link to="/numbers/active" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Active Numbers</Link>
          <Link to="/orders" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Order History</Link>
          <Link to="/credits" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Buy Credits</Link>
        </div>
      )}
    </nav>
  );
}
