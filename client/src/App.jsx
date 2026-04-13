import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import axios from 'axios';
import api from './api/axios';
import useAuthStore from './store/authStore';
import { getMe } from './api/user';

// Layouts
import UserLayout from './components/layout/UserLayout';
import AdminLayout from './components/layout/AdminLayout';

// Public pages
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import ResetPasswordPage from './pages/public/ResetPasswordPage';
import OAuthCallbackPage from './pages/public/OAuthCallbackPage';

// Dashboard pages
import DashboardPage from './pages/dashboard/DashboardPage';
import BrowseNumbersPage from './pages/dashboard/BrowseNumbersPage';
import CountryServicesPage from './pages/dashboard/CountryServicesPage';
import ActiveNumbersPage from './pages/dashboard/ActiveNumbersPage';
import BuyCreditsPage from './pages/dashboard/BuyCreditsPage';
import TransactionHistoryPage from './pages/dashboard/TransactionHistoryPage';
import OrderHistoryPage from './pages/dashboard/OrderHistoryPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import PaymentVerifyPage from './pages/dashboard/PaymentVerifyPage';

// Admin pages
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage';
import AdminTransactionsPage from './pages/admin/AdminTransactionsPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminCatalogPage from './pages/admin/AdminCatalogPage';
import AdminPricingPage from './pages/admin/AdminPricingPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  const { setAuth, setLoading, accessToken } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';
        const { data } = await axios.post(`${apiBase}/auth/refresh`, {}, { withCredentials: true });
        const token = data.data.accessToken;
        useAuthStore.getState().setAccessToken(token);
        const userRes = await api.get('/user/me');
        setAuth(userRes.data.data.user, token);
      } catch {
        if (import.meta.env.DEV) {
          // Mock user for UI review — remove before production
          setAuth({
            _id: 'dev-user',
            name: 'Dev Admin',
            email: 'admin@verifynow.com',
            role: 'ADMIN',
            creditBalance: 1250,
            provider: 'LOCAL',
            isEmailVerified: true,
            createdAt: new Date().toISOString(),
          }, 'dev-token');
        } else {
          setLoading(false);
        }
      }
    };
    initAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* User dashboard */}
        <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/numbers" element={<BrowseNumbersPage />} />
          <Route path="/numbers/active" element={<ActiveNumbersPage />} />
          <Route path="/numbers/:countryId" element={<CountryServicesPage />} />
          <Route path="/credits" element={<BuyCreditsPage />} />
          <Route path="/transactions" element={<TransactionHistoryPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/payments/verify" element={<PaymentVerifyPage />} />
          <Route path="/payments/success" element={<PaymentVerifyPage />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="transactions" element={<AdminTransactionsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="catalog" element={<AdminCatalogPage />} />
          <Route path="pricing" element={<AdminPricingPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
        </Route>

        <Route path="*" element={<div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4"><h1 className="text-3xl font-bold text-gray-900">404 — Page not found</h1><a href="/dashboard" className="text-brand-600 hover:underline">Go to Dashboard</a></div>} />
      </Routes>
    </BrowserRouter>
  );
}
