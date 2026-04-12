// FILE: /frontend/src/components/NotificationBell.jsx

import { useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useUiStore } from '../store/uiStore';
import { timeAgo } from '../utils/formatters';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, clearNotifications } = useUiStore();
  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-surface-400 hover:text-white transition-colors"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse-soft">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-surface-800 border border-surface-700/50 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-surface-700/50">
              <h4 className="text-sm font-semibold text-white">Notifications</h4>
              {unreadCount > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-surface-500 text-sm">
                  No notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 border-b border-surface-700/30 hover:bg-surface-700/20 transition-colors"
                  >
                    <p className="text-sm text-white">{notif.title}</p>
                    <p className="text-xs text-surface-400 mt-0.5">{notif.message}</p>
                    <p className="text-[10px] text-surface-500 mt-1">
                      {timeAgo(notif.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
