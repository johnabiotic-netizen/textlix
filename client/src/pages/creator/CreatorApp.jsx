import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import useAuthStore from '../../store/authStore';
import CreatorLayout from '../../components/layout/CreatorLayout';
import api from '../../api/axios';

const CreatorLandingPage = lazy(() => import('./CreatorLandingPage'));
const CreatorApplyPage = lazy(() => import('./CreatorApplyPage'));
const CreatorLoginPage = lazy(() => import('./CreatorLoginPage'));
const CreatorDashboardPage = lazy(() => import('./CreatorDashboardPage'));
const CreatorEarningsPage = lazy(() => import('./CreatorEarningsPage'));
const CreatorReferralsPage = lazy(() => import('./CreatorReferralsPage'));
const CreatorWithdrawalsPage = lazy(() => import('./CreatorWithdrawalsPage'));

const Spinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
  </div>
);

function CreatorProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) {
    const tried = sessionStorage.getItem('ssoTried');
    if (!tried) {
      sessionStorage.setItem('ssoTried', '1');
      const apiBase = import.meta.env.VITE_API_URL || '';
      window.location.href = `${apiBase}/api/v1/auth/sso/creator`;
      return <Spinner />;
    }
    sessionStorage.removeItem('ssoTried');
    return <Navigate to="/login" replace />;
  }
  sessionStorage.removeItem('ssoTried');
  return children;
}

export default function CreatorApp() {
  const { setAuth } = useAuthStore();
  const [ssoReady, setSsoReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sso = params.get('sso');
    if (!sso) { setSsoReady(true); return; }

    // Exchange SSO token BEFORE routing so CreatorProtectedRoute sees the user
    api.post('/auth/sso/exchange', { ssoToken: sso })
      .then(({ data }) => {
        sessionStorage.removeItem('ssoTried');
        setAuth(data.data.user, data.data.accessToken);
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch(() => sessionStorage.removeItem('ssoTried'))
      .finally(() => setSsoReady(true));
  }, []);

  if (!ssoReady) return <Spinner />;

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<CreatorLandingPage />} />
        <Route path="/apply" element={<CreatorApplyPage />} />
        <Route path="/login" element={<CreatorLoginPage />} />
        <Route element={<CreatorProtectedRoute><CreatorLayout /></CreatorProtectedRoute>}>
          <Route path="/dashboard" element={<CreatorDashboardPage />} />
          <Route path="/earnings" element={<CreatorEarningsPage />} />
          <Route path="/referrals" element={<CreatorReferralsPage />} />
          <Route path="/withdrawals" element={<CreatorWithdrawalsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
