import { useLocation } from 'react-router-dom';
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { useUiStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import NotificationBell from './NotificationBell';

const routeMeta = {
  '/': {
    placeholder: 'Search itineraries, clients, or flights...',
  },
  '/leads': {
    placeholder: 'Search conversations, clients, or tags...',
  },
  '/bookings': {
    placeholder: 'Search leads, clients, or trips...',
  },
  '/customers': {
    placeholder: 'Search traveler profiles...',
  },
  '/packages': {
    placeholder: 'Search packages or destinations...',
  },
  '/payments': {
    placeholder: 'Search bookings, invoices, or guests...',
  },
  '/analytics': {
    placeholder: 'Search metrics, campaigns, or agents...',
  },
  '/settings': {
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
  const meta = routeMeta[location.pathname] || routeMeta['/'];

  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl lg:left-[252px]">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4 lg:px-4">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={meta.placeholder}
            className="shell-input pl-11"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <NotificationBell />
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:flex"
          >
            <QuestionMarkCircleIcon className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,#43c3b4,#0d6a5f)] text-xs font-bold text-white">
            {getInitials(agent?.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
