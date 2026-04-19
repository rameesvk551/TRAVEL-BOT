// FILE: /frontend/src/App.jsx

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Bookings from './pages/Bookings';
import Customers from './pages/Customers';
import Packages from './pages/Packages';
import PackageForm from './pages/PackageForm';
import Payments from './pages/Payments';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Templates from './pages/Templates';
import Itineraries from './pages/Itineraries';
import ItineraryBuilder from './pages/ItineraryBuilder';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import CreateCampaign from './pages/CreateCampaign';
import Reviews from './pages/Reviews';
import Agents from './pages/Agents';
import Sidebar from './components/Sidebar';

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
    <div className="flex h-screen overflow-hidden bg-[#f5f5f5] text-[#1a1a1a]">
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto bg-[#f5f5f5] transition-[padding] duration-300"
        style={{ paddingLeft: isDesktop ? (isCollapsed ? 72 : 252) : 0 }}
      >
        <div className="page-enter min-h-full p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/bookings" element={<Bookings />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/packages" element={<Packages />} />
                  <Route path="/packages/new" element={<PackageForm />} />
                  <Route path="/packages/:id/edit" element={<PackageForm />} />
                  <Route path="/itineraries" element={<Itineraries />} />
                  <Route path="/itineraries/new" element={<ItineraryBuilder />} />
                  <Route path="/itineraries/:id/edit" element={<ItineraryBuilder />} />
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/campaigns/new" element={<CreateCampaign />} />
                  <Route path="/campaigns/:id/edit" element={<CreateCampaign />} />
                  <Route path="/campaigns/:id" element={<CampaignDetail />} />
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
