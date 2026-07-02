import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  BuildingOfficeIcon,
  ChatBubbleBottomCenterTextIcon,
  Cog6ToothIcon,
  LinkIcon,
  SquaresPlusIcon,
  DocumentTextIcon,
  UserCircleIcon,
  CursorArrowRaysIcon,
  TagIcon,
  KeyIcon,
  FunnelIcon,
  BanknotesIcon,
  PaperAirplaneIcon,
  ClipboardDocumentListIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';

const NAVIGATION = [
  { name: 'General', path: '/settings/general', icon: BuildingOfficeIcon },
  { name: 'Company Profile', path: '/settings/company-profile', icon: UserCircleIcon },
  { name: 'Invoice Templates', path: '/settings/invoice-templates', icon: DocumentTextIcon },
  { name: 'Quotation Templates', path: '/settings/quotation-templates', icon: DocumentTextIcon },
  { name: 'Itinerary Templates', path: '/settings/itinerary-templates', icon: DocumentTextIcon },
  { name: 'Receipt Templates', path: '/settings/receipt-templates', icon: DocumentTextIcon },
  { name: 'Document Sending', path: '/settings/documents', icon: PaperAirplaneIcon },
  { name: 'Welcome Menu', path: '/settings/welcome-menu', icon: ChatBubbleBottomCenterTextIcon },
  { name: 'Flow Builder', path: '/flow-builder', icon: CursorArrowRaysIcon },
  { name: 'Instagram Flow Builder', path: '/instagram-flow-builder', icon: CursorArrowRaysIcon },
  { name: 'Automations', path: '/settings/automations', icon: Cog6ToothIcon },
  { name: 'Integrations', path: '/settings/integrations', icon: LinkIcon },
  { name: 'Website API', path: '/settings/api-keys', icon: KeyIcon },
  { name: 'Accounts', path: '/settings/accounts', icon: BanknotesIcon },
  { name: 'Vendor Types', path: '/settings/vendor-types', icon: TagIcon },
  { name: 'Lead Sources', path: '/settings/lead-sources', icon: FunnelIcon },
  { name: 'Pipeline Statuses', path: '/settings/pipeline-statuses', icon: QueueListIcon },
  { name: 'Lead Form', path: '/settings/lead-form', icon: ClipboardDocumentListIcon },

];

export default function SettingsLayout() {
  const location = useLocation();
  const agency = useAuthStore((s) => s.agency);

  const prefs = agency?.sidebarPreferences || [];
  const hasPrefs = prefs.length > 0;

  const visibleNav = NAVIGATION.filter((item) => {
    if (item.path === '/settings/vendor-types') {
      if (hasPrefs) return prefs.includes(item.path);
      return true;
    }
    return true;
  });

  return (
    <div className="w-full space-y-5 page-enter">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Keep your agency profile, WhatsApp channel, and automations aligned in one quiet control room.
          </p>
        </div>
      </section>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:w-64 shrink-0 border-b md:border-b-0 border-neutral-200 snap-x snap-mandatory">
          {visibleNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] font-semibold transition-all whitespace-nowrap shrink-0 snap-start ${
                  isActive || (item.path === '/settings/general' && location.pathname === '/settings')
                    ? 'bg-neutral-900 text-white shadow-md'
                    : 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
