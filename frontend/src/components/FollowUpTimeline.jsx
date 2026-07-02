import React from 'react';
import { formatPhone, truncate } from '../utils/formatters';
import { CheckIcon, PhoneIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { getInitials } from './uiHelpers';

export default function FollowUpTimeline({ followUps, onStatusChange }) {
  // Sort follow-ups by time
  const sorted = [...followUps].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  // Group by hour
  const grouped = sorted.reduce((acc, followUp) => {
    const date = new Date(followUp.scheduledAt);
    const hour = date.getHours().toString().padStart(2, '0') + '.00';
    if (!acc[hour]) {
      acc[hour] = [];
    }
    acc[hour].push(followUp);
    return acc;
  }, {});

  const hours = Object.keys(grouped).sort();

  return (
    <div className="w-full max-w-4xl bg-gradient-to-br from-[#f8f9ff] to-[#f1f3fd] p-6 md:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Today's Appointments</h2>
          <p className="text-slate-500 mt-1 text-sm font-medium">Your schedule for the day</p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm font-bold text-slate-700">
          {followUps.length}
        </div>
      </div>

      <div className="relative border-l-2 border-[#e0e4fa] ml-4 md:ml-10 space-y-10 pb-4">
        {hours.map((hour) => (
          <div key={hour} className="relative">
            {/* Timeline Dot & Time */}
            <div className="absolute -left-[33px] md:-left-[73px] top-4 flex items-center w-[60px] md:w-[100px]">
              <span className="text-sm font-bold text-slate-700 w-12 md:w-16 text-right pr-4">{hour}</span>
              <div className="w-[11px] h-[11px] rounded-full bg-[#8c9eff] shadow-[0_0_0_4px_#f1f3fd] absolute right-0"></div>
            </div>

            {/* Cards for this hour */}
            <div className="pl-8 md:pl-12 space-y-4">
              {grouped[hour].map((followUp) => {
                const lead = followUp.lead || {};
                const customer = lead.customer || {};
                const isDone = followUp.status === 'Done';
                
                return (
                  <div
                    key={followUp.id}
                    className={`group relative flex items-center justify-between p-4 md:p-5 rounded-2xl bg-white border transition-all duration-300 ${
                      isDone 
                        ? 'border-emerald-100 bg-emerald-50/30' 
                        : 'border-transparent hover:border-[#8c9eff] hover:shadow-[0_8px_24px_rgba(140,158,255,0.15)] shadow-[0_2px_10px_rgba(0,0,0,0.03)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className={`flex shrink-0 items-center justify-center w-12 h-12 rounded-full font-bold text-sm ${
                        isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {customer.name ? getInitials(customer.name, 'L') : 'NA'}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-base font-bold truncate ${isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {customer.name || 'Unknown Client'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <p className="text-sm text-slate-500 font-medium truncate max-w-[120px] sm:max-w-[200px]">
                            {lead.destination || 'General Enquiry'}
                          </p>
                          <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8c9eff] shrink-0">
                            {lead.status?.replace(/_/g, ' ') || 'NEW'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    {!isDone && (
                      <div className="flex items-center gap-1 sm:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <button
                          onClick={() => window.open(`tel:${customer.phone}`)}
                          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors border border-slate-200"
                          title="Call Client"
                        >
                          <PhoneIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => onStatusChange(followUp, 'Done')}
                          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-white hover:bg-black transition-colors shadow-sm"
                          title="Mark as Done"
                        >
                          <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {hours.length === 0 && (
          <div className="pl-12 py-10">
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h3 className="text-slate-700 font-bold">No appointments left today</h3>
              <p className="text-slate-500 text-sm mt-1">You're all caught up!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
