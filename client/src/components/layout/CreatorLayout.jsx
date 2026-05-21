import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiHome, FiDollarSign, FiUsers, FiCreditCard, FiLogOut } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { logout } from '../../api/auth';
import Logo from '../common/Logo';

const nav = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/earnings', icon: FiDollarSign, label: 'Earnings' },
  { to: '/referrals', icon: FiUsers, label: 'Referrals' },
  { to: '/withdrawals', icon: FiCreditCard, label: 'Withdrawals' },
];

export default function CreatorLayout() {
  const { logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    storeLogout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <Logo textClassName="text-sm" />
          <p className="text-xs text-brand-600 font-medium mt-1 ml-7">Creator Program</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
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
