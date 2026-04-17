import React, { useState } from 'react';
import { Plus, Gift, CreditCard, TrendingUp, Copy } from 'lucide-react';
import { useReferrals, useReferralStats } from '../hooks/useReferrals';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function Referrals() {
  const { data: listData, isLoading: listLoading } = useReferrals();
  const { data: statsData } = useReferralStats();
  
  const codes = listData?.data || [];
  const stats = statsData?.data || { totalCodes: 0, activeCodes: 0, totalUses: 0, totalRevenue: 0, topReferrers: [] };

  return (
   <div className="p-8 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Gift className="w-6 h-6 text-pink-500" /> Referral Program
           </h1>
          <p className="text-slate-500 mt-1">Manage discount codes and reward enthusiastic travelers.</p>
        </div>
        <button className="shell-button-primary bg-pink-600 hover:bg-pink-700">
          <Plus className="w-4 h-4 mr-2" />
          Generate Code
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="shell-panel p-5 bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-xl shadow-lg shadow-pink-500/20">
            <Gift className="w-8 h-8 opacity-50 mb-4" />
            <p className="text-pink-100 font-medium">Active Codes</p>
            <p className="text-3xl font-bold mt-1">{stats.activeCodes}</p>
         </div>
         <div className="shell-panel p-5">
            <TrendingUp className="w-8 h-8 text-teal-600 mb-4 bg-teal-50 rounded-md p-1.5" />
            <p className="text-slate-500 font-medium text-sm">Total Uses</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalUses}</p>
         </div>
         <div className="shell-panel p-5 md:col-span-2">
            <CreditCard className="w-8 h-8 text-emerald-600 mb-4 bg-emerald-50 rounded-md p-1.5" />
            <p className="text-slate-500 font-medium text-sm">Revenue Generated via Referrals</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{formatCurrency(stats.totalRevenue)}</p>
         </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
         {/* Code List */}
         <div className="col-span-2 shell-panel p-0 overflow-hidden">
             <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
               <h3 className="font-semibold text-slate-800">All Referral Codes</h3>
             </div>
             
             {listLoading ? (
                <div className="p-8 text-center text-slate-500">Loading...</div>
             ) : (
             <div className="overflow-x-auto min-h-[300px]">
               <table className="w-full text-left">
                 <thead>
                   <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                     <th className="p-4 px-6">Code</th>
                     <th className="p-4">Customer</th>
                     <th className="p-4">Discount</th>
                     <th className="p-4 text-center">Uses</th>
                     <th className="p-4">Status</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 text-sm">
                   {codes.map(c => (
                     <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="p-4 px-6">
                           <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{c.code}</span>
                              <button className="text-slate-400 hover:text-slate-700"><Copy className="w-3.5 h-3.5"/></button>
                           </div>
                        </td>
                        <td className="p-4">
                           <p className="font-medium text-slate-900">{c.customer?.name}</p>
                           <p className="text-slate-500">{c.customer?.phone}</p>
                        </td>
                        <td className="p-4 font-semibold text-pink-600">
                           {c.discountType === 'FLAT' ? formatCurrency(c.discountValue) : `${c.discountValue}% OFF`}
                        </td>
                        <td className="p-4 text-center">
                           <span className="font-bold text-slate-900">{c.usedCount}</span>
                           <span className="text-slate-400 text-xs ml-1">/ {c.maxUses}</span>
                        </td>
                        <td className="p-4">
                           <div className={`w-2 h-2 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        </td>
                     </tr>
                   ))}
                   {codes.length === 0 && (
                      <tr><td colSpan="5" className="p-8 text-center text-slate-500">No referral codes active</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
             )}
         </div>

         {/* Leaderboard */}
         <div className="shell-panel p-0 self-start">
             <div className="p-4 border-b border-slate-100 bg-slate-50">
               <h3 className="font-semibold text-slate-800">Top Referrers</h3>
             </div>
             <div className="divide-y divide-slate-100">
                {stats.topReferrers.map((r, i) => (
                   <div key={r.id} className="p-4 flex items-center gap-4">
                      <div className="font-bold text-slate-300 text-lg w-4 text-center">{i + 1}</div>
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                         {r.customer?.name?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="font-semibold text-slate-900 truncate">{r.customer?.name}</p>
                         <p className="text-sm text-slate-500">{r.usedCount} successful referrals</p>
                      </div>
                   </div>
                ))}
                {stats.topReferrers.length === 0 && (
                   <div className="p-8 text-center text-slate-500">No uses recorded yet.</div>
                )}
             </div>
         </div>
      </div>
    </div>
  );
}
