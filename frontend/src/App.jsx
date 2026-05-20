// FILE: /frontend/src/App.jsx

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { usePlatformAuthStore } from './store/platformAuthStore';
import { useUiStore } from './store/uiStore';
import Sidebar from './components/Sidebar';
import AppTopbar from './components/AppTopbar';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const FollowUps = lazy(() => import('./pages/FollowUps'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Customers = lazy(() => import('./pages/Customers'));
const Packages = lazy(() => import('./pages/Packages'));
const PackageForm = lazy(() => import('./pages/PackageForm'));
const Properties = lazy(() => import('./pages/Properties'));
const PropertyDetails = lazy(() => import('./pages/PropertyDetails'));
const PropertyForm = lazy(() => import('./pages/PropertyForm'));
const Payments = lazy(() => import('./pages/Payments'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const WebsiteBuilder = lazy(() => import('./pages/WebsiteBuilder'));
const Templates = lazy(() => import('./pages/Templates'));
const Flows = lazy(() => import('./pages/Flows'));
const Itineraries = lazy(() => import('./pages/Itineraries'));
const ItineraryBuilder = lazy(() => import('./pages/ItineraryBuilder'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'));
const CreateCampaign = lazy(() => import('./pages/CreateCampaign'));
const AdsDashboard = lazy(() => import('./pages/AdsDashboard'));
const CreateAd = lazy(() => import('./pages/CreateAd'));
const Reviews = lazy(() => import('./pages/Reviews'));
const SocialMedia = lazy(() => import('./pages/SocialMedia'));
const Agents = lazy(() => import('./pages/Agents'));
const Signup = lazy(() => import('./pages/Signup'));
const Brochure = lazy(() => import('./pages/Brochure'));
const PlatformLogin = lazy(() => import('./pages/PlatformLogin'));
const PlatformDashboard = lazy(() => import('./pages/PlatformDashboard'));
const InstagramAuthCallback = lazy(() => import('./pages/InstagramAuthCallback'));

function RouteLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f5] px-4 text-center">
      <div>
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-neutral-200 border-t-[#00A884]" />
        <p className="mt-4 text-sm font-semibold text-neutral-500">Loading Wayon...</p>
      </div>
    </div>
  );
}

/**
 * Protected route wrapper — redirects to login if not authenticated.
 */
function ProtectedRoute({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return children;
}

function PlatformProtectedRoute({ children }) {
  const accessToken = usePlatformAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/platform/login" replace />;
  return children;
}

/**
 * Layout wrapper with sidebar for authenticated pages.
 */
function AppLayout({ children }) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarHovered = useUiStore((s) => s.sidebarHovered);
  const [isDesktop, setIsDesktop] = React.useState(window.innerWidth >= 1024);

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isCollapsed = sidebarCollapsed && !sidebarHovered;

  return (
    <div className="flex min-h-dvh overflow-hidden bg-[#f5f5f5] text-[#1a1a1a]">
      <Sidebar />
      <AppTopbar />
      <main
        className="flex-1 overflow-y-auto bg-[#f5f5f5] pt-16 transition-[padding] duration-300 lg:pt-0"
        style={{ paddingLeft: isDesktop ? (isCollapsed ? 72 : 252) : 0 }}
      >
        <div className="page-enter min-h-full px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/brochure" element={<Brochure />} />
          <Route path="/platform/login" element={<PlatformLogin />} />
          <Route
            path="/platform/*"
            element={
              <PlatformProtectedRoute>
                <PlatformDashboard />
              </PlatformProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/leads" element={<Leads />} />
                    <Route path="/follow-ups" element={<FollowUps />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/packages" element={<Packages />} />
                    <Route path="/packages/new" element={<PackageForm />} />
                    <Route path="/packages/:id/edit" element={<PackageForm />} />
                    <Route path="/properties" element={<Properties />} />
                    <Route path="/properties/new" element={<PropertyForm />} />
                    <Route path="/properties/:id/edit" element={<PropertyForm />} />
                    <Route path="/properties/:id" element={<PropertyDetails />} />
                    <Route path="/itineraries" element={<Itineraries />} />
                    <Route path="/itineraries/new" element={<ItineraryBuilder />} />
                    <Route path="/itineraries/:id/edit" element={<ItineraryBuilder />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/flows" element={<Flows />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/campaigns/new" element={<CreateCampaign />} />
                    <Route path="/campaigns/:id/edit" element={<CreateCampaign />} />
                    <Route path="/campaigns/:id" element={<CampaignDetail />} />
                    <Route path="/ads" element={<AdsDashboard />} />
                    <Route path="/ads/new" element={<CreateAd />} />
                    <Route path="/social" element={<SocialMedia />} />
                    <Route path="/reviews" element={<Reviews />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/agents" element={<Agents />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/website-builder" element={<WebsiteBuilder />} />
                    <Route path="/auth/meta/callback" element={<InstagramAuthCallback />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
