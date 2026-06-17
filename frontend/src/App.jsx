// FILE: /frontend/src/App.jsx

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { usePlatformAuthStore } from './store/platformAuthStore';
import { useUiStore } from './store/uiStore';
import { useBrandingStore } from './store/brandingStore';
import { useBranding } from './hooks/useBranding';
import { industryModuleVisible, TRAVEL_INDUSTRY } from './config/industryProfiles';
import Sidebar from './components/Sidebar';
import AppTopbar from './components/AppTopbar';

const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const FollowUps = lazy(() => import('./pages/FollowUps'));
const Bookings = lazy(() => import('./pages/Bookings'));
const BookingForm = lazy(() => import('./pages/BookingForm'));
const Customers = lazy(() => import('./pages/Customers'));
const WhatsAppInbox = lazy(() => import('./pages/WhatsAppInbox'));
const Packages = lazy(() => import('./pages/Packages'));
const PackageForm = lazy(() => import('./pages/PackageForm'));
const Properties = lazy(() => import('./pages/Properties'));
const PropertyDetails = lazy(() => import('./pages/PropertyDetails'));
const PropertyForm = lazy(() => import('./pages/PropertyForm'));
const Payments = lazy(() => import('./pages/Payments'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Analytics = lazy(() => import('./pages/Analytics'));
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const SettingsGeneral = lazy(() => import('./pages/settings/SettingsGeneral'));
const SettingsCompanyProfile = lazy(() => import('./pages/settings/SettingsCompanyProfile'));
const SettingsInvoiceTemplates = lazy(() => import('./pages/settings/SettingsInvoiceTemplates'));
const SettingsWelcomeMenu = lazy(() => import('./pages/settings/SettingsWelcomeMenu'));
const SettingsFlowBuilder = lazy(() => import('./pages/settings/SettingsFlowBuilder'));
const SettingsInstagramFlowBuilder = lazy(() => import('./pages/settings/SettingsInstagramFlowBuilder'));
const SettingsAutomations = lazy(() => import('./pages/settings/SettingsAutomations'));
const SettingsIntegrations = lazy(() => import('./pages/settings/SettingsIntegrations'));
const SettingsSidebarModules = lazy(() => import('./pages/settings/SettingsSidebarModules'));
const SettingsApiKeys = lazy(() => import('./pages/settings/SettingsApiKeys'));
const SettingsVendorTypes = lazy(() => import('./pages/settings/SettingsVendorTypes'));
const WebsiteBuilder = lazy(() => import('./pages/WebsiteBuilder'));
const Templates = lazy(() => import('./pages/Templates'));
const Flows = lazy(() => import('./pages/Flows'));
const Itineraries = lazy(() => import('./pages/Itineraries'));
const ItineraryBuilder = lazy(() => import('./pages/ItineraryBuilder'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignReports = lazy(() => import('./pages/CampaignReports'));
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
const Cruises = lazy(() => import('./pages/Cruises'));
const CruiseForm = lazy(() => import('./pages/CruiseForm'));
const Visas = lazy(() => import('./pages/Visas'));
const VisaForm = lazy(() => import('./pages/VisaForm'));
const PlatformDashboard = lazy(() => import('./pages/PlatformDashboard'));
const PlatformPartners = lazy(() => import('./pages/platform/Partners'));
const InstagramAuthCallback = lazy(() => import('./pages/InstagramAuthCallback'));
const Services = lazy(() => import('./pages/Services'));
const ServiceForm = lazy(() => import('./pages/ServiceForm'));
const Vendors = lazy(() => import('./pages/Vendors/Vendors'));
const GlobalVendorPayments = lazy(() => import('./pages/Vendors/GlobalVendorPayments'));
const Hrm = lazy(() => import('./pages/hrm/Hrm'));

function RouteLoading() {
  const brandName = useBrandingStore((s) => s.branding.brandName);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f5f5f5] px-4 text-center">
      <div>
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-neutral-200 border-t-[var(--brand-primary,#00A884)]" />
        <p className="mt-4 text-sm font-semibold text-neutral-500">Loading {brandName || 'workspace'}...</p>
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

function isModuleEnabled(agency, modulePath) {
  const prefs = agency?.sidebarPreferences;
  // Explicit per-tenant preference wins.
  if (Array.isArray(prefs) && prefs.length > 0) return prefs.includes(modulePath);
  // Otherwise fall back to the industry profile's default module set.
  return industryModuleVisible(agency?.industry || TRAVEL_INDUSTRY, modulePath);
}

function ModuleRoute({ modulePath, children }) {
  const agency = useAuthStore((s) => s.agency);
  if (!isModuleEnabled(agency, modulePath)) return <Navigate to="/" replace />;
  return children;
}

/**
 * Layout wrapper with sidebar for authenticated pages.
 */
function AppLayout({ children }) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarHovered = useUiStore((s) => s.sidebarHovered);
  const [isDesktop, setIsDesktop] = React.useState(window.innerWidth >= 1024);
  const location = useLocation();
  const isFullScreenPage = location.pathname === '/whatsapp';

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
        className={`flex-1 bg-[#f5f5f5] pt-16 transition-[padding] duration-300 lg:pt-0 ${isFullScreenPage ? 'overflow-hidden' : 'overflow-y-auto'}`}
        style={{ paddingLeft: isDesktop ? (isCollapsed ? 72 : 252) : 0 }}
      >
        {isFullScreenPage ? (
          <div className="page-enter h-full">
            {children}
          </div>
        ) : (
          <div className="page-enter min-h-full px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 md:p-6">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  // Resolve + apply white-label branding for the current host on boot.
  useBranding();
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/brochure" element={<Brochure />} />
          <Route path="/platform/login" element={<PlatformLogin />} />
          <Route
            path="/platform/partners"
            element={
              <PlatformProtectedRoute>
                <PlatformPartners />
              </PlatformProtectedRoute>
            }
          />
          <Route
            path="/platform/*"
            element={
              <PlatformProtectedRoute>
                <PlatformDashboard />
              </PlatformProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/leads" element={<ModuleRoute modulePath="/leads"><Leads /></ModuleRoute>} />
                    <Route path="/follow-ups" element={<ModuleRoute modulePath="/follow-ups"><FollowUps /></ModuleRoute>} />
                    <Route path="/bookings" element={<ModuleRoute modulePath="/bookings"><Bookings /></ModuleRoute>} />
                    <Route path="/bookings/new" element={<ModuleRoute modulePath="/bookings"><BookingForm /></ModuleRoute>} />
                    <Route path="/bookings/:id/edit" element={<ModuleRoute modulePath="/bookings"><BookingForm /></ModuleRoute>} />
                    <Route path="/customers" element={<ModuleRoute modulePath="/customers"><Customers /></ModuleRoute>} />
                    <Route path="/whatsapp" element={<ModuleRoute modulePath="/whatsapp"><WhatsAppInbox /></ModuleRoute>} />
                    <Route path="/packages" element={<ModuleRoute modulePath="/packages"><Packages /></ModuleRoute>} />
                    <Route path="/packages/new" element={<ModuleRoute modulePath="/packages"><PackageForm /></ModuleRoute>} />
                    <Route path="/packages/:id/edit" element={<ModuleRoute modulePath="/packages"><PackageForm /></ModuleRoute>} />
                    <Route path="/cruises" element={<ModuleRoute modulePath="/cruises"><Cruises /></ModuleRoute>} />
                    <Route path="/cruises/new" element={<ModuleRoute modulePath="/cruises"><CruiseForm /></ModuleRoute>} />
                    <Route path="/cruises/:id/edit" element={<ModuleRoute modulePath="/cruises"><CruiseForm /></ModuleRoute>} />
                    <Route path="/visas" element={<ModuleRoute modulePath="/visas"><Visas /></ModuleRoute>} />
                    <Route path="/visas/new" element={<ModuleRoute modulePath="/visas"><VisaForm /></ModuleRoute>} />
                    <Route path="/visas/:id/edit" element={<ModuleRoute modulePath="/visas"><VisaForm /></ModuleRoute>} />
                    <Route path="/services" element={<ModuleRoute modulePath="/services"><Services /></ModuleRoute>} />
                    <Route path="/services/new" element={<ModuleRoute modulePath="/services"><ServiceForm /></ModuleRoute>} />
                    <Route path="/services/:id/edit" element={<ModuleRoute modulePath="/services"><ServiceForm /></ModuleRoute>} />
                    <Route path="/properties" element={<ModuleRoute modulePath="/properties"><Properties /></ModuleRoute>} />
                    <Route path="/properties/new" element={<ModuleRoute modulePath="/properties"><PropertyForm /></ModuleRoute>} />
                    <Route path="/properties/:id/edit" element={<ModuleRoute modulePath="/properties"><PropertyForm /></ModuleRoute>} />
                    <Route path="/properties/:id" element={<ModuleRoute modulePath="/properties"><PropertyDetails /></ModuleRoute>} />
                    <Route path="/itineraries" element={<ModuleRoute modulePath="/itineraries"><Itineraries /></ModuleRoute>} />
                    <Route path="/itineraries/new" element={<ModuleRoute modulePath="/itineraries"><ItineraryBuilder /></ModuleRoute>} />
                    <Route path="/itineraries/:id/edit" element={<ModuleRoute modulePath="/itineraries"><ItineraryBuilder /></ModuleRoute>} />
                    <Route path="/templates" element={<ModuleRoute modulePath="/templates"><Templates /></ModuleRoute>} />
                    <Route path="/flows" element={<ModuleRoute modulePath="/flows"><Flows /></ModuleRoute>} />
                    <Route path="/flow-builder" element={<ModuleRoute modulePath="/flows"><SettingsFlowBuilder fullScreen /></ModuleRoute>} />
                    <Route path="/instagram-flow-builder" element={<ModuleRoute modulePath="/flows"><SettingsInstagramFlowBuilder fullScreen /></ModuleRoute>} />
                    <Route path="/campaigns" element={<ModuleRoute modulePath="/campaigns"><Campaigns /></ModuleRoute>} />
                    <Route path="/campaigns/reports" element={<ModuleRoute modulePath="/campaigns"><CampaignReports /></ModuleRoute>} />
                    <Route path="/campaigns/new" element={<ModuleRoute modulePath="/campaigns"><CreateCampaign /></ModuleRoute>} />
                    <Route path="/campaigns/:id/edit" element={<ModuleRoute modulePath="/campaigns"><CreateCampaign /></ModuleRoute>} />
                    <Route path="/campaigns/:id" element={<ModuleRoute modulePath="/campaigns"><CampaignDetail /></ModuleRoute>} />
                    <Route path="/ads" element={<ModuleRoute modulePath="/ads"><AdsDashboard /></ModuleRoute>} />
                    <Route path="/ads/new" element={<ModuleRoute modulePath="/ads"><CreateAd /></ModuleRoute>} />
                    <Route path="/social" element={<ModuleRoute modulePath="/social"><SocialMedia /></ModuleRoute>} />
                    <Route path="/reviews" element={<ModuleRoute modulePath="/reviews"><Reviews /></ModuleRoute>} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/accounts" element={<ModuleRoute modulePath="/accounts"><Accounts /></ModuleRoute>} />
                    <Route path="/vendors" element={<ModuleRoute modulePath="/vendors"><Vendors /></ModuleRoute>} />
                    <Route path="/vendor-payments" element={<ModuleRoute modulePath="/vendor-payments"><GlobalVendorPayments /></ModuleRoute>} />
                    <Route path="/hrm" element={<ModuleRoute modulePath="/hrm"><Hrm /></ModuleRoute>} />
                    <Route path="/analytics" element={<ModuleRoute modulePath="/analytics"><Analytics /></ModuleRoute>} />
                    <Route path="/agents" element={<ModuleRoute modulePath="/agents"><Agents /></ModuleRoute>} />
                    <Route path="/settings" element={<ModuleRoute modulePath="/settings"><SettingsLayout /></ModuleRoute>}>
                      <Route index element={<Navigate to="general" replace />} />
                      <Route path="general" element={<SettingsGeneral />} />
                      <Route path="company-profile" element={<SettingsCompanyProfile />} />
                      <Route path="invoice-templates" element={<SettingsInvoiceTemplates />} />
                      <Route path="welcome-menu" element={<SettingsWelcomeMenu />} />
                      <Route path="flow-builder" element={<Navigate to="/flow-builder" replace />} />
                      <Route path="automations" element={<SettingsAutomations />} />
                      <Route path="integrations" element={<SettingsIntegrations />} />
                      <Route path="api-keys" element={<SettingsApiKeys />} />
                      <Route path="sidebar-modules" element={<SettingsSidebarModules />} />
                      <Route path="vendor-types" element={<SettingsVendorTypes />} />
                    </Route>
                    <Route path="/website-builder" element={<ModuleRoute modulePath="/website-builder"><WebsiteBuilder /></ModuleRoute>} />
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
