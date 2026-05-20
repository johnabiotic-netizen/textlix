import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import useAuthStore from '../../store/authStore';
import CreatorLayout from '../../components/layout/CreatorLayout';

const CreatorLandingPage = lazy(() => import('./CreatorLandingPage'));
const CreatorApplyPage = lazy(() => import('./CreatorApplyPage'));
const CreatorDashboardPage = lazy(() => import('./CreatorDashboardPage'));
const CreatorEarningsPage = lazy(() => import('./CreatorEarningsPage'));
const CreatorReferralsPage = lazy(() => import('./CreatorReferralsPage'));
const CreatorWithdrawalsPage = lazy(() => import('./CreatorWithdrawalsPage'));

const Spinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
  </div>
);

function CreatorProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Simple login page redirect — creator subdomain uses the main app's login
function CreatorLoginRedirect() {
  window.location.href = 'https://www.textlix.com/login';
  return <Spinner />;
}

export default function CreatorApp() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<CreatorLandingPage />} />
        <Route path="/apply" element={<CreatorApplyPage />} />
        <Route path="/login" element={<CreatorLoginRedirect />} />

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
