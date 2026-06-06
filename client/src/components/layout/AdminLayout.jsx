import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FiMenu, FiLogOut, FiExternalLink } from 'react-icons/fi';
import { MdDashboard, MdPeople, MdReceipt, MdPayment, MdPhoneAndroid, MdPublic, MdAttachMoney, MdSettings, MdBarChart, MdLocalOffer, MdCampaign, MdSupportAgent, MdBadge } from 'react-icons/md';
import useAuthStore from '../../store/authStore';
import { logout as logoutApi } from '../../api/auth';
import toast from 'react-hot-toast';
import Logo from '../common/Logo';

// `perm` is the section key checked against an agent's permissions. Admins see
// everything. `adminOnly` items (agent management) are never shown to agents.
const NAV = [
  { to: '/admin', icon: MdDashboard, label: 'Overview', end: true, perm: 'overview' },
  { to: '/admin/users', icon: MdPeople, label: 'Users', perm: 'users' },
  { to: '/admin/transactions', icon: MdReceipt, label: 'Transactions', perm: 'transactions' },
  { to: '/admin/payments', icon: MdPayment, label: 'Payments', perm: 'payments' },
  { to: '/admin/orders', icon: MdPhoneAndroid, label: 'Orders', perm: 'orders' },
  { to: '/admin/catalog', icon: MdPublic, label: 'Catalog', perm: 'catalog' },
  { to: '/admin/pricing', icon: MdAttachMoney, label: 'Pricing', perm: 'pricing' },
  { to: '/admin/settings', icon: MdSettings, label: 'Settings', perm: 'settings' },
  { to: '/admin/promo-codes', icon: MdLocalOffer, label: 'Promo Codes', perm: 'promo-codes' },
  { to: '/admin/reports', icon: MdBarChart, label: 'Reports', perm: 'reports' },
  { to: '/admin/creators', icon: MdCampaign, label: 'Creators', perm: 'creators' },
  { to: '/admin/support', icon: MdSupportAgent, label: 'Support', perm: 'support' },
  { to: '/admin/agents', icon: MdBadge, label: 'Agents', perm: 'agents', adminOnly: true },
];

function navMatch(pathname) {
  return (
    NAV.find((n) => n.to !== '/admin' && (pathname === n.to || pathname.startsWith(n.to + '/'))) ||
    NAV.find((n) => n.to === '/admin' && pathname === '/admin')
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const perms = user?.permissions || [];
  const canSee = (item) => (item.adminOnly ? isAdmin : isAdmin || perms.includes(item.perm));
  const visibleNav = NAV.filter(canSee);

  // Keep agents out of sections they aren't granted (direct URLs + the index).
  useEffect(() => {
    if (!user || isAdmin) return;
    const current = navMatch(location.pathname);
    const allowed = current && canSee(current);
    if (!allowed) {
      const fallback = visibleNav[0]?.to || '/admin/support';
      if (location.pathname !== fallback) navigate(fallback, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user]);

  const handleLogout = async () => {
    try { await logoutApi(); } catch (_) {}
    logout();
    navigate('/login');
    toast.success('Logged out');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full text-white" style={{ backgroundColor: '#0A1831' }}>
      <div className="p-6 border-b border-white/10">
        <Logo dark textClassName="text-lg" />
        <div className="text-xs text-white/40 mt-1">{isAdmin ? 'Admin Panel' : 'Agent Panel'}</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-brand-500 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2">
        <a href="/dashboard" target="_blank" className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
          <FiExternalLink size={15} /> View as User
        </a>
        <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 rounded-lg hover:bg-white/10 transition-colors w-full">
          <FiLogOut size={15} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 flex-shrink-0">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:pl-64 overflow-hidden">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 h-16 flex items-center justify-between flex-shrink-0">
          <button className="lg:hidden text-gray-500 dark:text-gray-400" onClick={() => setSidebarOpen(true)}>
            <FiMenu size={22} />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{isAdmin ? 'Administrator' : 'Support Agent'}</p>
            </div>
            {user?.avatar ? (
              <img src={user.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
