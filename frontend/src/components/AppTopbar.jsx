import { useLocation } from 'react-router-dom';
import {
  Bars3Icon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useUiStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import NotificationBell from './NotificationBell';

const routeMeta = {
  '/': {
    title: 'Dashboard',
    placeholder: 'Search itineraries, clients, or flights...',
  },
  '/leads': {
    title: 'Leads',
    placeholder: 'Search conversations, clients, or tags...',
  },
  '/follow-ups': {
    title: 'Follow-ups',
    placeholder: 'Search scheduled calls, clients, or trips...',
  },
  '/bookings': {
    title: 'Bookings',
    placeholder: 'Search leads, clients, or trips...',
  },
  '/customers': {
    title: 'Customers',
    placeholder: 'Search traveler profiles...',
  },
  '/packages': {
    title: 'Packages',
    placeholder: 'Search packages or destinations...',
  },
  '/itineraries': {
    title: 'Itineraries',
    placeholder: 'Search itineraries...',
  },
  '/templates': {
    title: 'Templates',
    placeholder: 'Search templates...',
  },
  '/campaigns': {
    title: 'Campaigns',
    placeholder: 'Search campaigns...',
  },
  '/reviews': {
    title: 'Reviews',
    placeholder: 'Search reviews...',
  },
  '/payments': {
    title: 'Payments',
    placeholder: 'Search bookings, invoices, or guests...',
  },
  '/analytics': {
    title: 'Reports',
    placeholder: 'Search metrics, campaigns, or agents...',
  },
  '/agents': {
    title: 'Users',
    placeholder: 'Search users...',
  },
  '/settings': {
    title: 'Settings',
    placeholder: 'Search settings, providers, or channels...',
  },
};

function getInitials(name) {
  return (
    name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'LC'
  );
}

export default function AppTopbar() {
  const location = useLocation();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const agent = useAuthStore((state) => state.agent);
  const routeKey = Object.keys(routeMeta)
    .sort((a, b) => b.length - a.length)
    .find((key) => key === '/' ? location.pathname === '/' : location.pathname.startsWith(key));
  const meta = routeMeta[routeKey] || routeMeta['/'];

  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-xl lg:hidden">
      <div className="flex h-16 items-center gap-2 px-3 pt-[env(safe-area-inset-top)] sm:px-4">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-neutral-200 bg-white text-neutral-600 transition active:scale-[0.98]"
          aria-label="Open navigation"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">WayOn</p>
          <h1 className="truncate text-base font-extrabold tracking-tight text-neutral-900">{meta.title}</h1>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-neutral-500 transition active:scale-[0.98]"
            aria-label={meta.placeholder}
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>
          <NotificationBell />
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
            {getInitials(agent?.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
