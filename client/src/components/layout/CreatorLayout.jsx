import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiHome, FiDollarSign, FiUsers, FiCreditCard, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';
import { logout } from '../../api/auth';
import Logo from '../common/Logo';
import ThemeToggle from '../common/ThemeToggle';

const nav = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/earnings', icon: FiDollarSign, label: 'Earnings' },
  { to: '/referrals', icon: FiUsers, label: 'Referrals' },
  { to: '/withdrawals', icon: FiCreditCard, label: 'Withdrawals' },
];

export default function CreatorLayout() {
  const { logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    storeLogout();
    navigate('/');
  };

  const Sidebar = ({ onClose }) => (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <Logo textClassName="text-sm" />
          <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-0.5 ml-9">Creator Program</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden">
            <FiX size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <ThemeToggle />
          <span className="text-xs text-gray-500 dark:text-gray-400">Toggle theme</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white w-full transition-colors"
        >
          <FiLogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0">
        <div className="h-full fixed w-60">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:pl-60">
        {/* Mobile top header */}
        <header className="lg:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <FiMenu size={20} />
          </button>
          <Logo textClassName="text-sm" />
          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-8 py-6 pb-24 lg:pb-8">
          <div className="max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-2 py-2 safe-area-bottom">
          <div className="flex justify-around">
            {nav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-gray-500 dark:text-gray-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`p-1.5 rounded-lg ${isActive ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}>
                      <Icon size={18} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
