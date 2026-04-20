// FILE: /frontend/src/components/Sidebar.jsx

import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { useLogout } from '../hooks/useAuth';
import {
  HomeIcon,
  CalendarDaysIcon,
  UsersIcon,
  UserGroupIcon,
  CubeIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  MegaphoneIcon,
  QueueListIcon,
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { getInitials } from './uiHelpers';

const navItems = [
  { to: '/', icon: HomeIcon, label: 'Dashboard' },
  { to: '/leads', icon: QueueListIcon, label: 'Leads' },
  { to: '/bookings', icon: CalendarDaysIcon, label: 'Bookings' },
  { to: '/customers', icon: UserGroupIcon, label: 'Customers' },
  { to: '/agents', icon: UsersIcon, label: 'Users' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
];

const utilityItems = [
  { to: '/itineraries', icon: DocumentDuplicateIcon, label: 'Itineraries' },
  { to: '/packages', icon: CubeIcon, label: 'Packages' },
  { to: '/analytics', icon: ChartBarIcon, label: 'Reports' },
];

const marketingItems = [
  { to: '/templates', icon: QueueListIcon, label: 'Templates' },
  { to: '/campaigns', icon: MegaphoneIcon, label: 'Campaigns' },
  { to: '/reviews', icon: StarIcon, label: 'Reviews' },
];

export default function Sidebar() {
  const { agent, agency, updateAgent } = useAuthStore();
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

  const collapsed = sidebarCollapsed && !sidebarHovered; // desktop collapsed state unless hovered

  const renderNavItem = ({ to, icon: Icon, label }, exactEnd = false) => {
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
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-neutral-200 bg-white transition-all duration-300 ${collapsed ? 'w-[72px] px-2' : 'w-[252px] px-4'
          } py-4 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Agency name + collapse toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 shadow-xl overflow-hidden p-1.5 shrink-0">
                <img src="/favicon.png" alt="Logo" className="h-full w-full object-contain brightness-0 invert" />
              </div>
              <div>
                <p className="text-[15px] font-bold tracking-tight text-neutral-900 leading-tight">
                  {agency?.name || 'Travel CRM'}
                </p>
                <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Concierge</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 shadow-lg overflow-hidden p-1.5">
              <img src="/favicon.png" alt="Logo" className="h-full w-full object-contain brightness-0 invert" />
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

        {/* Agent info */}
        <div
          className={`mt-4 flex items-center rounded-[var(--radius-md)] border border-neutral-100 bg-neutral-50 ${collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-3'
            }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-sm">
            {getInitials(agent?.name, 'LC')}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {agent?.name || 'Lead Curator'}
              </p>
              <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${agent?.isOnline ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                {agent?.isOnline ? 'Active Now' : 'Offline'}
              </p>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="mt-6 space-y-1">
          {navItems.map((item) =>
            renderNavItem(item, item.to === '/')
          )}
        </nav>

        {/* Workspace section */}
        {!collapsed && (
          <div className="mt-6 px-3">
            <p className="eyebrow">Workspace</p>
          </div>
        )}
        {collapsed && <hr className="mx-auto mt-6 w-8 border-neutral-200" />}
        <nav className="mt-2 space-y-1">
          {utilityItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Marketing section */}
        {!collapsed && (
          <div className="mt-6 px-3">
            <p className="eyebrow">Marketing</p>
          </div>
        )}
        {collapsed && <hr className="mx-auto mt-6 w-8 border-neutral-200" />}
        <nav className="mt-2 space-y-1">
          {marketingItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Bottom actions */}
        <div className="mt-auto space-y-2 pt-6">
          <div className={`flex flex-col items-center justify-center gap-1.5 pb-2 border-t border-neutral-100 pt-6`}>
            {!collapsed && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">Powered By</span>}
            <div className={`flex items-center justify-center ${collapsed ? 'flex-col gap-1' : 'gap-2.5'}`}>
              <div className={`flex items-center justify-center rounded-lg bg-neutral-900 shadow-sm overflow-hidden ${collapsed ? 'h-8 w-8 p-1.5' : 'h-7 w-7 p-1.5'}`}>
                <img src="/favicon.png" alt="Wayon Logo" className="h-full w-full object-contain brightness-0 invert opacity-90" />
              </div>
              {!collapsed && <span className="text-[14px] font-bold tracking-tight text-neutral-900 italic">WayOn</span>}
            </div>
          </div>

          <button
            onClick={() => logoutMutation.mutate()}
            title={collapsed ? 'Logout' : undefined}
            className={`flex w-full items-center rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 ${collapsed ? 'justify-center' : 'gap-3'
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
