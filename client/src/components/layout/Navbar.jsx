import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiUser, FiSettings } from 'react-icons/fi';
import { RiCoinLine } from 'react-icons/ri';
import useAuthStore from '../../store/authStore';
import { logout as logoutApi } from '../../api/auth';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch (_) {}
    logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">✓</span>
            <span className="font-display font-bold text-gray-900 text-lg">TextLix</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link to="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link to="/numbers" className="text-sm font-medium text-gray-600 hover:text-gray-900">Get Number</Link>
            <Link to="/credits" className="text-sm font-medium text-gray-600 hover:text-gray-900">Buy Credits</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/credits" className="hidden md:flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-amber-100 transition-colors">
              <RiCoinLine size={16} className="text-credit" />
              {user?.creditBalance?.toLocaleString() ?? '0'}
            </Link>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-1.5 transition-colors"
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
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <div className="p-1">
                      <Link to="/settings" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                        <FiSettings size={15} /> Settings
                      </Link>
                      <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg w-full">
                        <FiLogOut size={15} /> Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button className="md:hidden text-gray-600" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 px-4 py-3 space-y-2 bg-white">
          <Link to="/dashboard" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          <Link to="/numbers" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Get Number</Link>
          <Link to="/credits" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Buy Credits</Link>
          <Link to="/transactions" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>History</Link>
        </div>
      )}
    </nav>
  );
}
