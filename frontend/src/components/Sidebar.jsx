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
  SignalIcon,
  SignalSlashIcon,
  PlusIcon,
  MegaphoneIcon,
  QueueListIcon,
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';
import { getInitials } from './uiHelpers';

const navItems = [
  { to: '/', icon: HomeIcon, label: 'Dashboard' },
  { to: '/bookings', icon: CalendarDaysIcon, label: 'Leads' },
  { to: '/customers', icon: UserGroupIcon, label: 'Clients' },
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

  const toggleOnline = async () => {
    const newStatus = !agent?.isOnline;
    try {
      await client.patch('/agents/me/status', { isOnline: newStatus });
      updateAgent({ isOnline: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

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
        className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
          collapsed ? 'justify-center' : ''
        } ${
          active
            ? 'bg-slate-100 text-[#0d6a5f]'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        {active && !collapsed && (
          <span className="absolute inset-y-2 right-0 w-0.5 rounded-full bg-[#0d6a5f]" />
        )}
        {active && collapsed && (
          <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#0d6a5f]" />
        )}
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm transition lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={toggleSidebar}
      />

      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ${
          collapsed ? 'w-[72px] px-2' : 'w-[252px] px-4'
        } py-4 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Agency name + collapse toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {!collapsed && (
            <p className="text-[15px] font-semibold tracking-tight text-slate-900">
              {agency?.name || 'Travel CRM'}
            </p>
          )}
          <button
            onClick={toggleSidebarCollapse}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Agent info */}
        <div
          className={`mt-5 flex items-center rounded-[12px] border border-slate-200 bg-slate-50 ${
            collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-3'
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,#43c3b4,#0d6a5f)] text-sm font-bold text-white">
            {getInitials(agent?.name, 'LC')}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {agent?.name || 'Lead Curator'}
              </p>
              <p className="text-xs text-slate-500">
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
        {collapsed && <hr className="mx-auto mt-6 w-8 border-slate-200" />}
        <nav className="mt-2 space-y-1">
          {utilityItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Marketing section */}
        {!collapsed && (
          <div className="mt-6 px-3">
            <p className="eyebrow">Marketing</p>
          </div>
        )}
        {collapsed && <hr className="mx-auto mt-6 w-8 border-slate-200" />}
        <nav className="mt-2 space-y-1">
          {marketingItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Bottom actions */}
        <div className="mt-auto space-y-2 pt-6">
          <NavLink
            to="/packages/new"
            title={collapsed ? 'New Itinerary' : undefined}
            className={`shell-button-primary w-full ${collapsed ? '!px-0 justify-center' : ''}`}
          >
            <PlusIcon className="h-4 w-4 shrink-0" />
            {!collapsed && 'New Itinerary'}
          </NavLink>

          <button
            onClick={toggleOnline}
            title={collapsed ? (agent?.isOnline ? 'Available for handoff' : 'Marked offline') : undefined}
            className={`flex w-full items-center rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
              collapsed ? 'justify-center' : 'gap-3'
            } ${
              agent?.isOnline
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {agent?.isOnline ? (
              <SignalIcon className="h-5 w-5 shrink-0" />
            ) : (
              <SignalSlashIcon className="h-5 w-5 shrink-0" />
            )}
            {!collapsed && (
              <span>{agent?.isOnline ? 'Available for handoff' : 'Marked offline'}</span>
            )}
          </button>

          <button
            onClick={() => logoutMutation.mutate()}
            title={collapsed ? 'Logout' : undefined}
            className={`flex w-full items-center rounded-[10px] px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 ${
              collapsed ? 'justify-center' : 'gap-3'
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
