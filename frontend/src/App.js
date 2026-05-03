import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import useModeStore from '@/stores/modeStore';
import { Toaster } from '@/components/ui/toaster';
import ChatWidget from '@/components/chat/ChatWidget';

import MarketingLayout from '@/layouts/MarketingLayout';
import AuthLayout from '@/layouts/AuthLayout';
import AppLayout from '@/layouts/AppLayout';
import AdminLayout from '@/layouts/AdminLayout';

import HomePage from '@/pages/marketing/HomePage';
import AboutPage from '@/pages/marketing/AboutPage';
import PrivacyPage from '@/pages/marketing/PrivacyPage';
import TermsPage from '@/pages/marketing/TermsPage';

import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

import BrowsePage from '@/pages/listings/BrowsePage';
import ListingDetailPage from '@/pages/listings/ListingDetailPage';

import DashboardPage from '@/pages/dashboard/DashboardPage';
import MyListingsPage from '@/pages/dashboard/MyListingsPage';
import CreateListingPage from '@/pages/dashboard/CreateListingPage';
import EditListingPage from '@/pages/dashboard/EditListingPage';
import WatchlistPage from '@/pages/dashboard/WatchlistPage';
import OffersPage from '@/pages/dashboard/OffersPage';
import OfferDetailPage from '@/pages/dashboard/OfferDetailPage';
import MessagesPage from '@/pages/dashboard/MessagesPage';
import VerificationPage from '@/pages/dashboard/VerificationPage';
import ProfilePage from '@/pages/dashboard/ProfilePage';
import EnrollPage from '@/pages/dashboard/seller/EnrollPage';
import AvailabilityPage from '@/pages/dashboard/seller/AvailabilityPage';
import CalendarPage from '@/pages/dashboard/seller/CalendarPage';
import ViewingsPage from '@/pages/dashboard/ViewingsPage';
import ViewingDetailPage from '@/pages/dashboard/ViewingDetailPage';

import AdminOverviewPage from '@/pages/admin/AdminOverviewPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminListingsPage from '@/pages/admin/AdminListingsPage';

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

// Requires the user to have opted into seller-land. Sends unenrolled users
// to the enrollment funnel; the enrollment page itself is authed but NOT
// seller-gated (otherwise no-one could ever reach it).
function SellerRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  const enrolled = !!user.sellerProfile?.enrolled || user.role === 'admin';
  if (!enrolled) return <Navigate to="/dashboard/seller/enroll" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <FullScreenLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { checkAuth, user, isLoading } = useAuthStore();
  const { initTheme } = useThemeStore();
  const { hydrateFromUser } = useModeStore();

  useEffect(() => {
    initTheme();
    checkAuth();
  }, [checkAuth, initTheme]);

  // Reconcile mode with the server's `preferences.lastMode` whenever the
  // user identity changes (login, logout, enrollment).
  useEffect(() => {
    if (!isLoading) hydrateFromUser(user);
  }, [user, isLoading, hydrateFromUser]);

  return (
    <>
      <Routes>
        {/* Marketing + public listing browse */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/buy" element={<BrowsePage listingType="sale" />} />
          <Route path="/rent" element={<BrowsePage listingType="rent" />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
        </Route>

        {/* Auth */}
        <Route element={<PublicOnlyRoute><AuthLayout /></PublicOnlyRoute>}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Authenticated app */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/watchlist" element={<WatchlistPage />} />
          <Route path="/dashboard/offers" element={<OffersPage />} />
          <Route path="/dashboard/offers/:id" element={<OfferDetailPage />} />
          <Route path="/dashboard/messages" element={<MessagesPage />} />
          <Route path="/dashboard/messages/:id" element={<MessagesPage />} />
          <Route path="/dashboard/viewings" element={<ViewingsPage />} />
          <Route path="/dashboard/viewings/:id" element={<ViewingDetailPage />} />
          <Route path="/dashboard/verification" element={<VerificationPage />} />
          <Route path="/dashboard/profile" element={<ProfilePage />} />
          {/* Seller enrollment funnel — authed but not seller-gated. */}
          <Route path="/dashboard/seller/enroll" element={<EnrollPage />} />

          {/* Seller-gated routes */}
          <Route element={<SellerRoute><Outlet /></SellerRoute>}>
            <Route path="/dashboard/listings" element={<MyListingsPage />} />
            <Route path="/dashboard/listings/new" element={<CreateListingPage />} />
            <Route path="/dashboard/listings/:id/edit" element={<EditListingPage />} />
            <Route path="/dashboard/seller/availability" element={<AvailabilityPage />} />
            <Route path="/dashboard/seller/calendar" element={<CalendarPage />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route path="/admin" element={<AdminOverviewPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/listings" element={<AdminListingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatWidget />
      <Toaster />
    </>
  );
}

