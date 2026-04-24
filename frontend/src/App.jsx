// FILE: /frontend/src/App.jsx

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import FollowUps from './pages/FollowUps';
import Bookings from './pages/Bookings';
import Customers from './pages/Customers';
import Packages from './pages/Packages';
import PackageForm from './pages/PackageForm';
import Properties from './pages/Properties';
import PropertyDetails from './pages/PropertyDetails';
import PropertyForm from './pages/PropertyForm';
import Payments from './pages/Payments';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Templates from './pages/Templates';
import Flows from './pages/Flows';
import Itineraries from './pages/Itineraries';
import ItineraryBuilder from './pages/ItineraryBuilder';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import CreateCampaign from './pages/CreateCampaign';
import AdsDashboard from './pages/AdsDashboard';
import CreateAd from './pages/CreateAd';
import Reviews from './pages/Reviews';
import SocialMedia from './pages/SocialMedia';
import Agents from './pages/Agents';
import Sidebar from './components/Sidebar';
import AppTopbar from './components/AppTopbar';
import Signup from './pages/Signup';

/**
 * Protected route wrapper — redirects to login if not authenticated.
 */
function ProtectedRoute({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
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
      <Routes>
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
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
