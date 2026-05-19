import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiHome, FiDollarSign, FiUsers, FiCreditCard, FiLogOut, FiLink } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { logout } from '../../api/auth';

const nav = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/earnings', icon: FiDollarSign, label: 'Earnings' },
  { to: '/referrals', icon: FiUsers, label: 'Referrals' },
  { to: '/withdrawals', icon: FiCreditCard, label: 'Withdrawals' },
];

export default function CreatorLayout() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    clearAuth();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <FiLink size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">TextLix</p>
              <p className="text-xs text-emerald-600 font-medium">Creator Program</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors"
          >
            <FiLogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
