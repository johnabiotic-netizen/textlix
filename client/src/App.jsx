import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import axios from 'axios';
import api from './api/axios';
import useAuthStore from './store/authStore';
import { getMe } from './api/user';
import { trackPageView } from './utils/tiktok';

// Fires a TikTok PageView on every route change. This is an SPA, so the pixel
// in index.html only sees the first load — without this, navigations are
// invisible to TikTok. Rendered inside <BrowserRouter> so it has router context.
function PixelPageViews() {
  const location = useLocation();
  useEffect(() => {
    trackPageView();
  }, [location.pathname]);
  return null;
}

// Layouts (small, load eagerly)
import UserLayout from './components/layout/UserLayout';
import AdminLayout from './components/layout/AdminLayout';
const CreatorApp = lazy(() => import('./pages/creator/CreatorApp'));

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
const AiRecommendPage = lazy(() => import('./pages/dashboard/AiRecommendPage'));
const CountryServicesPage = lazy(() => import('./pages/dashboard/CountryServicesPage'));
const ActiveNumbersPage = lazy(() => import('./pages/dashboard/ActiveNumbersPage'));
const BuyCreditsPage = lazy(() => import('./pages/dashboard/BuyCreditsPage'));
const TransactionHistoryPage = lazy(() => import('./pages/dashboard/TransactionHistoryPage'));
const OrderHistoryPage = lazy(() => import('./pages/dashboard/OrderHistoryPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const PaymentVerifyPage = lazy(() => import('./pages/dashboard/PaymentVerifyPage'));
const OrderDetailPage = lazy(() => import('./pages/dashboard/OrderDetailPage'));

const AdminPromoCodesPage = lazy(() => import('./pages/admin/AdminPromoCodesPage'));
const ApiKeysPage = lazy(() => import('./pages/dashboard/ApiKeysPage'));
const VirtualNumberLandingPage = lazy(() => import('./pages/public/VirtualNumberLandingPage'));

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
const AdminCreatorsPage = lazy(() => import('./pages/admin/AdminCreatorsPage'));
const AdminSupportPage = lazy(() => import('./pages/admin/AdminSupportPage'));
const AdminAgentsPage = lazy(() => import('./pages/admin/AdminAgentsPage'));

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
  if (user.role !== 'ADMIN' && user.role !== 'AGENT') return <Navigate to="/dashboard" replace />;
  return children;
}

// Allow-list redirects to *.textlix.com hostnames only — protects against open
// redirects like `evil.textlix.com.attacker.com` that pass a naive substring match.
function isSafeTextlixRedirect(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    return u.hostname === 'textlix.com' || u.hostname.endsWith('.textlix.com');
  } catch {
    return false;
  }
}

function PublicRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (user) {
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    if (redirect && isSafeTextlixRedirect(redirect)) {
      window.location.href = redirect;
      return null;
    }
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  }
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

const isCreatorSubdomain = window.location.hostname.startsWith('creator.');
// Local dev runs on a different origin than prod, so the cross-domain SSO bridge
// can't work here — it would just bounce localhost to textlix.com. Skip it so
// local testing stays on localhost; production behaviour is unchanged.
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// The SSO bridge does a full-page bounce to recover a session (Safari ITP
// workaround). It's only worth doing when the visitor is actually heading to an
// authenticated app route. Firing it on public marketing pages (landing,
// pricing, blog…) bounced every anonymous visitor through a redirect round-trip
// — wrecking load performance on exactly the pages that need to be fast.
const APP_ROUTE_PREFIXES = ['/dashboard', '/numbers', '/credits', '/orders', '/transactions', '/settings', '/api-keys', '/recommend', '/payments'];
const isAppRoute = () => APP_ROUTE_PREFIXES.some((p) => window.location.pathname.startsWith(p)) || window.location.pathname.startsWith('/admin');

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

    const cleanSsoParams = () => {
      const search = window.location.search
        .replace(/[?&]sso=[^&]*/g, '')
        .replace(/[?&]sso_failed=[^&]*/g, '')
        .replace(/^&/, '?');
      const clean = window.location.pathname + search;
      if (clean !== window.location.pathname + window.location.search) {
        window.history.replaceState({}, '', clean || window.location.pathname);
      }
    };

    const initAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const ssoToken = params.get('sso');
      const ssoFailed = params.get('sso_failed');

      // Clean any SSO params from URL upfront
      cleanSsoParams();

      // Exchange SSO token if present (came back from SSO bridge)
      if (ssoToken && !ssoFailed) {
        try {
          const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';
          const { data } = await axios.post(`${apiBase}/auth/sso/exchange-main`, { ssoToken }, { withCredentials: true });
          const token = data.data.accessToken;
          useAuthStore.getState().setAccessToken(token);
          const userRes = await api.get('/user/me');
          setAuth(userRes.data.data.user, token); // setAuth also clears mainSsoTried
          scheduleProactiveRefresh(token, doRefresh);
          return;
        } catch {}
      }

      // Try normal cookie refresh
      try {
        const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';
        const { data } = await axios.post(`${apiBase}/auth/refresh`, {}, { withCredentials: true });
        const token = data.data.accessToken;
        useAuthStore.getState().setAccessToken(token);
        const userRes = await api.get('/user/me');
        setAuth(userRes.data.data.user, token); // setAuth also clears mainSsoTried
        scheduleProactiveRefresh(token, doRefresh);
      } catch {
        // XHR refresh failed — try SSO bridge (browser navigation sends cookies automatically)
        const tried = sessionStorage.getItem('mainSsoTried');
        if (!tried && !isCreatorSubdomain && !ssoFailed && !isLocalDev && isAppRoute()) {
          sessionStorage.setItem('mainSsoTried', '1');
          const apiBase = import.meta.env.VITE_API_URL || '';
          const currentPath = window.location.pathname + window.location.search
            .replace(/[?&]sso=[^&]*/g, '').replace(/[?&]sso_failed=[^&]*/g, '').replace(/^&/, '?');
          window.location.href = `${apiBase}/api/v1/auth/sso/main?redirect=${encodeURIComponent(window.location.origin + currentPath)}`;
          return;
        }
        setLoading(false);
      }
    };
    initAuth();
    return () => { if (_refreshTimer) clearTimeout(_refreshTimer); };
  }, []);

  if (isCreatorSubdomain) {
    return (
      <BrowserRouter>
        <PixelPageViews />
        <Suspense fallback={<PageSpinner />}>
          <CreatorApp />
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <PixelPageViews />
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
          <Route path="/virtual-numbers/:countryCode/:serviceSlug" element={<VirtualNumberLandingPage />} />

          {/* User dashboard */}
          <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/recommend" element={<AiRecommendPage />} />
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
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/payments/verify" element={<PaymentVerifyPage />} />
            <Route path="/payments/success" element={<PaymentVerifyPage />} />
            <Route path="/payments/cancel" element={<PaymentVerifyPage />} />
            <Route path="/api-keys" element={<ApiKeysPage />} />
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
            <Route path="promo-codes" element={<AdminPromoCodesPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="creators" element={<AdminCreatorsPage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="agents" element={<AdminAgentsPage />} />
          </Route>

          <Route path="*" element={<div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4"><h1 className="text-3xl font-bold text-gray-900">404 — Page not found</h1><a href="/dashboard" className="text-brand-600 hover:underline">Go to Dashboard</a></div>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
