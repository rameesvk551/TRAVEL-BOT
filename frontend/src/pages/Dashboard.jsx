// FILE: /frontend/src/pages/Dashboard.jsx

import { useState } from 'react';
import { useAnalyticsSummary } from '../hooks/useAnalytics';
import { useLiveMessages } from '../hooks/useMessages';
import { useUiStore } from '../store/uiStore';
import StatsCard from '../components/StatsCard';
import LeadPipeline from '../components/LeadPipeline';
import ChatPanel from '../components/ChatPanel';
import NotificationBell from '../components/NotificationBell';
import { formatCurrency, timeAgo, truncate, formatPhone } from '../utils/formatters';
import {
  UserGroupIcon,
  ChatBubbleLeftEllipsisIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export default function Dashboard() {
  const { data: analyticsData } = useAnalyticsSummary();
  const { data: liveData } = useLiveMessages();
  const { chatPanelOpen, activeChatCustomerId, openChat, closeChat } = useUiStore();

  const analytics = analyticsData?.data || {};
  const liveMessages = liveData?.data || [];
  const [selectedLead, setSelectedLead] = useState(null);

  return (
    <div className="flex h-full">
      {/* Main scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-950/80 backdrop-blur-xl border-b border-surface-700/30">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-sm text-surface-400 mt-0.5">Overview of your travel business</p>
            </div>
            <NotificationBell />
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Today's Leads"
              value={analytics.newLeadsToday || 0}
              subtitle={`${analytics.totalLeads || 0} total`}
              icon={UserGroupIcon}
              color="blue"
            />
            <StatsCard
              title="Pending Quotes"
              value={analytics.leadsByStatus?.find?.((l) => l.status === 'QUOTED')?.count || 0}
              icon={ChatBubbleLeftEllipsisIcon}
              color="amber"
            />
            <StatsCard
              title="This Month Bookings"
              value={analytics.confirmedBookings || 0}
              subtitle={`${analytics.conversionRate || 0}% conversion`}
              icon={CalendarDaysIcon}
              color="green"
            />
            <StatsCard
              title="This Month Revenue"
              value={formatCurrency(analytics.totalRevenue || 0)}
              subtitle={`${analytics.pendingPayments || 0} pending`}
              icon={BanknotesIcon}
              color="purple"
            />
          </div>

          {/* Lead Pipeline */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Lead Pipeline</h2>
            <LeadPipeline onLeadClick={(lead) => {
              setSelectedLead(lead);
              if (lead.customer) {
                openChat(lead.customer.id);
              }
            }} />
          </div>

          {/* Action Needed */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" />
              Action Needed
            </h2>
            <div className="glass-card p-4">
              <div className="space-y-3">
                <ActionItem
                  title="Unassigned leads"
                  description="2 leads waiting for assignment"
                  action="Assign"
                  color="amber"
                />
                <ActionItem
                  title="Pending payment links"
                  description="1 confirmed booking without payment request"
                  action="Send Link"
                  color="blue"
                />
                <ActionItem
                  title="Active handoffs"
                  description="No agents handling transferred conversations"
                  action="View"
                  color="red"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar — Live messages */}
      <div className="hidden xl:flex flex-col w-[320px] border-l border-surface-700/30 bg-surface-900/50">
        <div className="px-4 py-4 border-b border-surface-700/30">
          <h3 className="text-sm font-semibold text-white">Live Messages</h3>
          <p className="text-xs text-surface-400 mt-0.5">Recent incoming</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {liveMessages.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-surface-500 text-sm">
              No recent messages
            </div>
          ) : (
            liveMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => openChat(msg.customerId)}
                className="px-4 py-3 border-b border-surface-700/20 hover:bg-surface-800/30 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-white">
                    {msg.customer?.name || formatPhone(msg.customer?.phone)}
                  </p>
                  <span className="text-[10px] text-surface-500">{timeAgo(msg.timestamp)}</span>
                </div>
                <p className="text-xs text-surface-400">{truncate(msg.content, 60)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat panel slide-over */}
      {chatPanelOpen && activeChatCustomerId && (
        <ChatPanel
          customerId={activeChatCustomerId}
          customerName={selectedLead?.customer?.name}
          customerPhone={selectedLead?.customer?.phone}
          isHandedOff={false}
          onClose={closeChat}
        />
      )}
    </div>
  );
}

function ActionItem({ title, description, action, color }) {
  const colorMap = {
    amber: 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20',
    blue: 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20',
    red: 'text-red-400 bg-red-500/10 hover:bg-red-500/20',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-surface-400">{description}</p>
      </div>
      <button className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${colorMap[color]}`}>
        {action}
      </button>
    </div>
  );
}
