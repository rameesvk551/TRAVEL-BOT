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
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_16px_30px_-24px_rgba(15,23,42,0.22)] animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
              {unreadCount > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-xs font-semibold text-[#0d1b3e] hover:text-[#0b5d54]"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="border-b border-slate-100 p-4 transition-colors hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">{notif.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{notif.message}</p>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
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
