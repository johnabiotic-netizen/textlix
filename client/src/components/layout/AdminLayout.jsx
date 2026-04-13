import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiExternalLink } from 'react-icons/fi';
import { MdDashboard, MdPeople, MdReceipt, MdPayment, MdPhoneAndroid, MdPublic, MdAttachMoney, MdSettings, MdBarChart } from 'react-icons/md';
import useAuthStore from '../../store/authStore';
import { logout as logoutApi } from '../../api/auth';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/admin', icon: MdDashboard, label: 'Overview', end: true },
  { to: '/admin/users', icon: MdPeople, label: 'Users' },
  { to: '/admin/transactions', icon: MdReceipt, label: 'Transactions' },
  { to: '/admin/payments', icon: MdPayment, label: 'Payments' },
  { to: '/admin/orders', icon: MdPhoneAndroid, label: 'Orders' },
  { to: '/admin/catalog', icon: MdPublic, label: 'Catalog' },
  { to: '/admin/pricing', icon: MdAttachMoney, label: 'Pricing' },
  { to: '/admin/settings', icon: MdSettings, label: 'Settings' },
  { to: '/admin/reports', icon: MdBarChart, label: 'Reports' },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try { await logoutApi(); } catch (_) {}
    logout();
    navigate('/login');
    toast.success('Logged out');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="p-6 border-b border-gray-800">
        <div className="font-display font-bold text-lg">✓ VerifyNow</div>
        <div className="text-xs text-gray-400 mt-1">Admin Panel</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800 space-y-2">
        <a href="/dashboard" target="_blank" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
          <FiExternalLink size={15} /> View as User
        </a>
        <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 rounded-lg hover:bg-gray-800 transition-colors w-full">
          <FiLogOut size={15} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:pl-64 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 h-16 flex items-center justify-between flex-shrink-0">
          <button className="lg:hidden text-gray-500" onClick={() => setSidebarOpen(true)}>
            <FiMenu size={22} />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-400">Administrator</p>
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
