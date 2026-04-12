// FILE: /frontend/src/components/Sidebar.jsx

import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { useLogout } from '../hooks/useAuth';
import {
  HomeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  UsersIcon,
  CubeIcon,
  CreditCardIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  SignalIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';
import client from '../api/client';

const navItems = [
  { to: '/', icon: HomeIcon, label: 'Dashboard' },
  { to: '/leads', icon: UserGroupIcon, label: 'Leads' },
  { to: '/bookings', icon: CalendarDaysIcon, label: 'Bookings' },
  { to: '/customers', icon: UsersIcon, label: 'Customers' },
  { to: '/packages', icon: CubeIcon, label: 'Packages' },
  { to: '/payments', icon: CreditCardIcon, label: 'Payments' },
  { to: '/analytics', icon: ChartBarIcon, label: 'Analytics' },
  { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
];

export default function Sidebar() {
  const { agent, agency, updateAgent } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const logoutMutation = useLogout();

  const toggleOnline = async () => {
    const newStatus = !agent?.isOnline;
    try {
      await client.patch('/agents/me/status', { isOnline: newStatus });
      updateAgent({ isOnline: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const initials = agency?.name
    ?.split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TB';

  return (
    <aside
      className={`flex flex-col h-screen bg-surface-900/80 backdrop-blur-xl border-r border-surface-700/50 transition-all duration-300 ${
        sidebarOpen ? 'w-[240px]' : 'w-[72px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-surface-700/50">
        <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-sm font-bold text-white shrink-0">
          {initials}
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden animate-fade-in">
            <p className="text-sm font-semibold text-white truncate">{agency?.name || 'TravelBot'}</p>
            <p className="text-xs text-surface-400 truncate">{agent?.name}</p>
          </div>
        )}
        <button onClick={toggleSidebar} className="ml-auto p-1 text-surface-400 hover:text-white transition-colors">
          <Bars3Icon className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : ''}`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-surface-700/50 space-y-2">
        {/* Online toggle */}
        <button
          onClick={toggleOnline}
          className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-sm transition-all duration-200 ${
            agent?.isOnline
              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
              : 'bg-surface-800/50 text-surface-400 hover:bg-surface-700/50'
          }`}
        >
          {agent?.isOnline ? (
            <SignalIcon className="w-5 h-5 shrink-0" />
          ) : (
            <SignalSlashIcon className="w-5 h-5 shrink-0" />
          )}
          {sidebarOpen && (
            <span className="font-medium">{agent?.isOnline ? 'Online' : 'Offline'}</span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={() => logoutMutation.mutate()}
          className="nav-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 shrink-0" />
          {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
