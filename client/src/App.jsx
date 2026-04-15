import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import axios from 'axios';
import api from './api/axios';
import useAuthStore from './store/authStore';
import { getMe } from './api/user';

// Layouts (small, load eagerly)
import UserLayout from './components/layout/UserLayout';
import AdminLayout from './components/layout/AdminLayout';

// Public pages — lazy
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const LoginPage = lazy(() => import('./pages/public/LoginPage'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/public/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage'));
const OAuthCallbackPage = lazy(() => import('./pages/public/OAuthCallbackPage'));
const FaqPage = lazy(() => import('./pages/public/FaqPage'));
const SupportPage = lazy(() => import('./pages/public/SupportPage'));
const TermsPage = lazy(() => import('./pages/public/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/public/PrivacyPage'));
const PricingPage = lazy(() => import('./pages/public/PricingPage'));
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const DocsPage = lazy(() => import('./pages/public/DocsPage'));
const BlogPage = lazy(() => import('./pages/public/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/public/BlogPostPage'));

// Dashboard pages — lazy
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const BrowseNumbersPage = lazy(() => import('./pages/dashboard/BrowseNumbersPage'));
const BrowseByModePage = lazy(() => import('./pages/dashboard/BrowseByModePage'));
const ServiceCountriesPage = lazy(() => import('./pages/dashboard/ServiceCountriesPage'));
const CountryServicesPage = lazy(() => import('./pages/dashboard/CountryServicesPage'));
const ActiveNumbersPage = lazy(() => import('./pages/dashboard/ActiveNumbersPage'));
const BuyCreditsPage = lazy(() => import('./pages/dashboard/BuyCreditsPage'));
const TransactionHistoryPage = lazy(() => import('./pages/dashboard/TransactionHistoryPage'));
const OrderHistoryPage = lazy(() => import('./pages/dashboard/OrderHistoryPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const PaymentVerifyPage = lazy(() => import('./pages/dashboard/PaymentVerifyPage'));

// Admin pages — lazy (recharts lives here, never hits regular users)
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'));
const AdminTransactionsPage = lazy(() => import('./pages/admin/AdminTransactionsPage'));
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminCatalogPage = lazy(() => import('./pages/admin/AdminCatalogPage'));
const AdminPricingPage = lazy(() => import('./pages/admin/AdminPricingPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));

const PageSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
  </div>
);

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <PageSpinner />;
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

// Decode JWT exp without a library (JWT payload is base64url, second segment)
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null; // convert to ms
  } catch {
    return null;
  }
}

let _refreshTimer = null;

function scheduleProactiveRefresh(token, refreshFn) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const expiry = getTokenExpiry(token);
  if (!expiry) return;
  const delay = expiry - Date.now() - 60_000; // refresh 60s before expiry
  if (delay > 0) {
    _refreshTimer = setTimeout(refreshFn, delay);
  } else {
    // Token expires in < 60s — refresh immediately
    refreshFn();
  }
}

export default function App() {
  const { setAuth, setLoading, accessToken } = useAuthStore();

  useEffect(() => {
    const doRefresh = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';
        const { data } = await axios.post(`${apiBase}/auth/refresh`, {}, { withCredentials: true });
        const token = data.data.accessToken;
        useAuthStore.getState().setAccessToken(token);
        const userRes = await api.get('/user/me');
        const user = userRes.data.data.user;
        setAuth(user, token);
        scheduleProactiveRefresh(token, doRefresh);
      } catch {
        useAuthStore.getState().setLoading(false);
      }
    };

    const initAuth = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';
        const { data } = await axios.post(`${apiBase}/auth/refresh`, {}, { withCredentials: true });
        const token = data.data.accessToken;
        useAuthStore.getState().setAccessToken(token);
        const userRes = await api.get('/user/me');
        setAuth(userRes.data.data.user, token);
        scheduleProactiveRefresh(token, doRefresh);
      } catch {
        if (import.meta.env.DEV) {
          // Mock user for UI review — remove before production
          setAuth({
            _id: 'dev-user',
            name: 'Dev Admin',
            email: 'admin@textlix.com',
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
    return () => { if (_refreshTimer) clearTimeout(_refreshTimer); };
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />

          {/* User dashboard */}
          <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/numbers" element={<BrowseNumbersPage />} />
            <Route path="/numbers/active" element={<ActiveNumbersPage />} />
            {/* OTP routes */}
            <Route path="/numbers/otp" element={<BrowseByModePage mode="otp" />} />
            <Route path="/numbers/otp/service/:serviceSlug" element={<ServiceCountriesPage mode="otp" />} />
            <Route path="/numbers/otp/:countryId" element={<CountryServicesPage mode="otp" />} />
            {/* Rental routes */}
            <Route path="/numbers/rental" element={<BrowseByModePage mode="rental" />} />
            <Route path="/numbers/rental/service/:serviceSlug" element={<ServiceCountriesPage mode="rental" />} />
            <Route path="/numbers/rental/:countryId" element={<CountryServicesPage mode="rental" />} />
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
      </Suspense>
    </BrowserRouter>
  );
}
