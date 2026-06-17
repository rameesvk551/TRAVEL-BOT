// FILE: /frontend/src/components/Sidebar.jsx

import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { useBrandingStore } from '../store/brandingStore';
import { useLogout } from '../hooks/useAuth';
import { useIndustry } from '../hooks/useIndustry';
import {
  HomeIcon,
  CalendarDaysIcon,
  UsersIcon,
  UserGroupIcon,
  CubeIcon,
  HomeModernIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  CurrencyRupeeIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  ClockIcon,
  MegaphoneIcon,
  QueueListIcon,
  ChatBubbleLeftRightIcon,
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  WrenchScrewdriverIcon,
  LifebuoyIcon,
  IdentificationIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
import { getInitials } from './uiHelpers';

const navItems = [
  { to: '/', icon: HomeIcon, label: 'Dashboard' },
  { to: '/leads', icon: QueueListIcon, label: 'Leads' },
  { to: '/follow-ups', icon: ClockIcon, label: 'Follow-ups' },
  { to: '/bookings', icon: CalendarDaysIcon, label: 'Bookings' },
  { to: '/customers', icon: UserGroupIcon, label: 'Customers' },
  { to: '/whatsapp', icon: ChatBubbleLeftRightIcon, label: 'WhatsApp' },
  { to: '/agents', icon: UsersIcon, label: 'Users' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
];

const utilityItems = [
  { to: '/properties', icon: HomeModernIcon, label: 'Properties' },
  { to: '/itineraries', icon: DocumentDuplicateIcon, label: 'Itineraries' },
  { to: '/packages', icon: CubeIcon, label: 'Packages' },
  { to: '/cruises', icon: LifebuoyIcon, label: 'Cruises' },
  { to: '/visas', icon: IdentificationIcon, label: 'Visas' },
  { to: '/services', icon: WrenchScrewdriverIcon, label: 'Services' },
  { to: '/vendors', icon: UsersIcon, label: 'Vendors' },
  { to: '/vendor-payments', icon: CurrencyRupeeIcon, label: 'Vendor Payments' },
  { to: '/accounts', icon: CurrencyRupeeIcon, label: 'Accounts' },
  { to: '/website-builder', icon: GlobeAltIcon, label: 'Website' },
  { to: '/hrm', icon: BriefcaseIcon, label: 'HR & Payroll' },
  { to: '/analytics', icon: ChartBarIcon, label: 'Reports' },
];

const marketingItems = [
  { to: '/templates', icon: QueueListIcon, label: 'Templates' },
  { to: '/flows', icon: DocumentDuplicateIcon, label: 'Flows' },
  { to: '/campaigns', icon: MegaphoneIcon, label: 'Campaigns' },
  { to: '/ads', icon: ChartBarIcon, label: 'Social Ads' },
  { to: '/social', icon: CubeIcon, label: 'Social Media' },
  { to: '/reviews', icon: StarIcon, label: 'Reviews' },
];

export default function Sidebar() {
  const { agent, agency, updateAgent } = useAuthStore();
  const branding = useBrandingStore((s) => s.branding);
  const {
    sidebarOpen,
    toggleSidebar,
    sidebarCollapsed,
    toggleSidebarCollapse,
    sidebarHovered,
    setSidebarHovered,
  } = useUiStore();
  const logoutMutation = useLogout();
  const location = useLocation();
  const { navLabel, moduleVisible } = useIndustry();

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const collapsed = isDesktop ? (sidebarCollapsed && !sidebarHovered) : false; // only collapse on desktop

  const prefs = agency?.sidebarPreferences || [];
  const hasPrefs = prefs.length > 0;

  // Visibility precedence: an explicit per-tenant preference wins; otherwise the
  // industry profile decides which modules show. Dashboard is always visible.
  const isVisible = (to) => {
    if (to === '/') return true;
    if (hasPrefs) return prefs.includes(to);
    return moduleVisible(to);
  };

  const visibleNavItems = navItems.filter((item) => isVisible(item.to));
  const visibleUtilityItems = utilityItems.filter((item) => isVisible(item.to));
  const visibleMarketingItems = marketingItems.filter((item) => isVisible(item.to));

  const renderNavItem = ({ to, icon: Icon, label }, exactEnd = false) => {
    label = navLabel(to, label);
    const active = exactEnd
      ? location.pathname === to
      : location.pathname.startsWith(to);

    return (
      <NavLink
        key={to}
        to={to}
        end={exactEnd}
        onClick={() => {
          if (window.innerWidth < 1024) toggleSidebar();
        }}
        title={collapsed ? label : undefined}
        className={`group relative flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium transition-all duration-200 ${collapsed ? 'justify-center' : ''
          } ${active
            ? 'bg-neutral-900 text-white shadow-sm'
            : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
          }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span>{label}</span>}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/25 backdrop-blur-sm transition lg:hidden ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        onClick={toggleSidebar}
      />

      <aside
        onMouseEnter={() => window.innerWidth >= 1024 && setSidebarHovered(true)}
        onMouseLeave={() => window.innerWidth >= 1024 && setSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-neutral-200 bg-white transition-all duration-300 ${collapsed ? 'w-[72px] px-2' : 'w-[252px] px-4'
          } overflow-y-auto py-4 pt-[calc(1rem+env(safe-area-inset-top))] lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Agency name + collapse toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 shadow-xl overflow-hidden p-1.5 shrink-0">
                <img src={branding.logoUrl || '/wayon-logo.svg'} alt="Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-[15px] font-bold tracking-tight text-neutral-900 leading-tight">
                  {agency?.name || branding.brandName}
                </p>
                <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Platform</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 shadow-lg overflow-hidden p-1.5">
              <img src="/wayon-logo.svg" alt="Logo" className="h-full w-full object-contain" />
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
              title="Collapse sidebar"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Agent/profile header removed as requested */}

        {/* Main nav */}
        <nav className="mt-6 space-y-1">
          {visibleNavItems.map((item) =>
            renderNavItem(item, item.to === '/')
          )}
        </nav>

        {/* Workspace section */}
        {visibleUtilityItems.length > 0 && !collapsed && (
          <div className="mt-6 px-3">
            <p className="eyebrow">Workspace</p>
          </div>
        )}
        {visibleUtilityItems.length > 0 && collapsed && <hr className="mx-auto mt-6 w-8 border-neutral-200" />}
        <nav className="mt-2 space-y-1">
          {visibleUtilityItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Marketing section */}
        {visibleMarketingItems.length > 0 && !collapsed && (
          <div className="mt-6 px-3">
            <p className="eyebrow">Marketing</p>
          </div>
        )}
        {visibleMarketingItems.length > 0 && collapsed && <hr className="mx-auto mt-6 w-8 border-neutral-200" />}
        <nav className="mt-2 space-y-1">
          {visibleMarketingItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Bottom actions */}
        <div className="mt-auto space-y-2 pt-6">
          <div className={`flex flex-col items-center justify-center gap-1.5 pb-2 border-t border-neutral-100 pt-6`}>
            {!collapsed && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">Powered By</span>}
            <div className={`flex items-center justify-center ${collapsed ? 'flex-col gap-1' : 'gap-2.5'}`}>
              <div className={`flex items-center justify-center rounded-lg bg-neutral-900 shadow-sm overflow-hidden ${collapsed ? 'h-8 w-8 p-1.5' : 'h-7 w-7 p-1.5'}`}>
                <img src={branding.logoUrl || '/wayon-logo.svg'} alt={`${branding.brandName} logo`} className="h-full w-full object-contain" />
              </div>
              {!collapsed && <span className="text-[14px] font-bold tracking-tight text-neutral-900 italic">{branding.brandName}</span>}
            </div>
          </div>

          <button
            onClick={() => logoutMutation.mutate()}
            title={collapsed ? 'Logout' : undefined}
            className={`hidden lg:flex w-full items-center rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 ${collapsed ? 'justify-center' : 'gap-3'
              }`}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
