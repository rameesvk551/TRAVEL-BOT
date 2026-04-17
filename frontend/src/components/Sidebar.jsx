// FILE: /frontend/src/components/Sidebar.jsx

import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { useLogout } from '../hooks/useAuth';
import {
  HomeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  UsersIcon,
  CubeIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SignalIcon,
  SignalSlashIcon,
  PlusIcon,
  MegaphoneIcon,
  QueueListIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';
import { getInitials } from './uiHelpers';

const navItems = [
  { to: '/', icon: HomeIcon, label: 'Dashboard' },
  { to: '/leads', icon: UserGroupIcon, label: 'Inbox' },
  { to: '/bookings', icon: CalendarDaysIcon, label: 'Leads' },
  { to: '/customers', icon: UsersIcon, label: 'Clients' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
];

const utilityItems = [
  { to: '/packages', icon: CubeIcon, label: 'Packages' },
  { to: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
];

const marketingItems = [
  { to: '/templates', icon: QueueListIcon, label: 'Templates' },
  { to: '/campaigns', icon: MegaphoneIcon, label: 'Campaigns' },
  { to: '/reviews', icon: StarIcon, label: 'Reviews' },
];

export default function Sidebar() {
  const { agent, agency, updateAgent } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const logoutMutation = useLogout();
  const location = useLocation();

  const toggleOnline = async () => {
    const newStatus = !agent?.isOnline;
    try {
      await client.patch('/agents/me/status', { isOnline: newStatus });
      updateAgent({ isOnline: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm transition lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={toggleSidebar}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-slate-200 bg-white px-4 py-4 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-2">
          <p className="text-[15px] font-semibold tracking-tight text-slate-900">{agency?.name || 'Travel CRM'}</p>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,#43c3b4,#0d6a5f)] text-sm font-bold text-white">
            {getInitials(agent?.name, 'LC')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{agent?.name || 'Lead Curator'}</p>
            <p className="text-xs text-slate-500">{agent?.isOnline ? 'Active Now' : 'Offline'}</p>
          </div>
        </div>

        <nav className="mt-6 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = to === '/' ? location.pathname === to : location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => {
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-100 text-[#0d6a5f]'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {active && <span className="absolute inset-y-2 right-0 w-0.5 rounded-full bg-[#0d6a5f]" />}
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-6 px-3">
          <p className="eyebrow">Workspace</p>
        </div>
        <nav className="mt-2 space-y-1">
          {utilityItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => {
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-100 text-[#0d6a5f]'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-6 px-3">
          <p className="eyebrow">Marketing</p>
        </div>
        <nav className="mt-2 space-y-1">
          {marketingItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => {
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-100 text-[#0d6a5f]'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 pt-6">
          <NavLink to="/packages/new" className="shell-button-primary w-full">
            <PlusIcon className="h-4 w-4" />
            New Itinerary
          </NavLink>

          <button
            onClick={toggleOnline}
            className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
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
            <span>{agent?.isOnline ? 'Available for handoff' : 'Marked offline'}</span>
          </button>

          <button
            onClick={() => logoutMutation.mutate()}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
