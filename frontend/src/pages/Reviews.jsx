import React, { useState } from 'react';
import { Star, Database, BadgeCheck, Filter, Reply, Share2 } from 'lucide-react';
import { useReviews, useReviewStats } from '../hooks/useReviews';
import { formatDate } from '../utils/formatters';

export default function Reviews() {
  const [filter, setFilter] = useState('All Reviews');
  const { data: listData, isLoading } = useReviews();
  const { data: statsData } = useReviewStats();
  
  const reviews = listData?.data || [];
  const stats = statsData?.data || { totalReviews: 0, avgRating: 0, publishedCount: 0, distribution: [] };

  return (
    <div className="p-8 space-y-8 animate-in fade-in max-w-7xl mx-auto">
      <div>
        <h1 className="text-[28px] font-bold text-[#0a1b3f] tracking-tight">Customer Intelligence</h1>
        <p className="text-slate-500 mt-1">Synthesized insights from across your luxury portfolio.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Avg Rating */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-8 border border-slate-100/60">
           <div className="grid grid-cols-2 gap-12 items-center h-full">
              <div>
                 <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">Average Rating</p>
                 <h1 className="text-[5rem] font-extrabold text-[#0a1b3f] leading-none mb-3 tracking-tighter">
                   {stats.avgRating.toFixed(1)}
                 </h1>
                 <div className="flex gap-1 mb-3">
                   {[1,2,3,4,5].map(i => <Star key={i} className={`w-5 h-5 ${i <= Math.round(stats.avgRating) ? 'fill-[#0a1b3f] text-[#0a1b3f]' : 'fill-slate-100 text-slate-100'}`} />)}
                 </div>
                 <p className="text-xs font-semibold text-slate-400">Based on {stats.totalReviews.toLocaleString()} global reviews</p>
              </div>
              
              <div className="space-y-4 relative">
                 {[5,4,3,2,1].map(r => {
                      const item = stats.distribution.find(d => parseInt(d.rating) === r) || { count: 0 };
                      const pct = stats.totalReviews > 0 ? (item.count / stats.totalReviews) * 100 : 0;
                      return (
                        <div key={r} className="flex items-center gap-4 text-xs font-bold border-r border-transparent">
                           <span className="w-12 text-[#0a1b3f]">{r} Star</span>
                           <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#0a1b3f] rounded-full" style={{width: `${pct}%`}}></div>
                           </div>
                           <span className="w-8 text-right text-slate-400">{Math.round(pct)}%</span>
                        </div>
                      )
                 })}
                 <div className="pt-2 text-right border-t border-transparent">
                    <button className="text-[11px] font-bold text-[#0a1b3f] uppercase flex items-center justify-end w-full gap-1 hover:underline tracking-wider">
                      View Segmentation &rarr;
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Panels */}
        <div className="space-y-6 flex flex-col justify-between">
           {/* Total Collected */}
           <div className="bg-slate-50/80 rounded-xl p-6 border border-slate-100 relative h-full flex flex-col justify-center">
              <div className="w-10 h-10 bg-white rounded flex items-center justify-center shadow-sm text-blue-600 mb-6 transition-transform hover:scale-105">
                 <Database className="w-5 h-5" strokeWidth={2.5} /> 
              </div>
              <div className="absolute top-6 right-6 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                 +12.4%
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Collected</p>
              <h2 className="text-3xl font-extrabold text-[#0a1b3f]">{stats.totalReviews.toLocaleString()}</h2>
           </div>

           {/* Published & Approved */}
           <div className="bg-[#0a1945] rounded-xl p-6 text-white relative h-full flex flex-col justify-center shadow-lg shadow-blue-900/20">
              <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center mb-6 backdrop-blur-sm transition-transform hover:scale-105">
                 <BadgeCheck className="w-5 h-5 text-blue-100" strokeWidth={2.5} />
              </div>
              <div className="absolute top-6 right-6 bg-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide backdrop-blur-sm">
                 STABLE
              </div>
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-2">Published & Approved</p>
              <h2 className="text-3xl font-extrabold">{stats.publishedCount.toLocaleString()}</h2>
           </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="flex bg-slate-100/80 p-1 rounded-lg gap-1 border border-slate-200/60">
          {['All Reviews', '5 Stars', '4 Stars', '3 Stars', 'Negative'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-md text-xs font-bold transition-all tracking-wide ${filter === f ? 'bg-[#0a1b3f] text-white shadow-sm' : 'text-slate-500 hover:text-[#0a1b3f] hover:bg-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="text-xs font-bold text-[#0a1b3f] flex items-center gap-2 hover:opacity-70 tracking-widest uppercase">
          <Filter className="w-4 h-4" /> Advanced Filters
        </button>
      </div>

      <div className="space-y-4">
         {isLoading ? <div className="p-8 text-slate-500 text-center font-medium">Loading insights...</div> : null}
         {reviews
            .filter(r => {
               if (filter === 'All Reviews') return true;
               if (filter === 'Negative') return r.rating <= 2;
               return r.rating.toString() === filter.charAt(0);
            })
            .map(r => {
               const initials = r.customer?.name 
                  ? r.customer.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() 
                  : 'UI';
                  
               let title = "Rating Only";
               let desc = "No testimonial provided.";
               if (r.testimonial) {
                  const parts = r.testimonial.split('.');
                  title = parts[0] + (r.testimonial.includes('.') ? '' : '');
                  desc = r.testimonial;
               }

               return (
                  <div key={r.id} className="bg-white rounded-xl p-6 border border-slate-100 flex gap-8 hover:shadow-lg hover:shadow-slate-200/50 transition-all group">
                     {/* Author info (Left) */}
                     <div className="w-48 flex-shrink-0 flex gap-4">
                        <div className="w-10 h-10 bg-blue-50 text-[#0a1b3f] rounded-full flex items-center justify-center font-bold text-xs tracking-wider border border-blue-100">
                           {initials}
                        </div>
                        <div className="pt-0.5">
                           <h3 className="font-bold text-xs text-[#0a1b3f] mb-1">{r.customer?.name || 'Unknown User'}</h3>
                           <p className="text-[10px] text-slate-400 font-semibold mb-2">{formatDate(r.createdAt)}</p>
                           <div className="flex">
                              {[...Array(r.rating)].map((_,i) => <Star key={i} className="w-3.5 h-3.5 fill-[#0a1b3f] text-[#0a1b3f]" />)}
                              {[...Array(5 - r.rating)].map((_,i) => <Star key={i} className="w-3.5 h-3.5 text-slate-200 fill-slate-200" />)}
                           </div>
                        </div>
                     </div>
                     
                     {/* Review text (Middle/Right) */}
                     <div className="flex-1 flex flex-col">
                        <h4 className="font-extrabold text-[#0a1b3f] text-[15px] mb-2 leading-tight">
                           {title}
                        </h4>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                           {desc}
                        </p>
                        
                        <div className="flex items-center justify-between mt-auto">
                           <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 tracking-wider">
                              <button className="flex items-center gap-1.5 hover:text-[#0a1b3f] transition-colors uppercase cursor-pointer">
                                 <Reply className="w-3.5 h-3.5" /> Respond
                              </button>
                              <button className="flex items-center gap-1.5 hover:text-[#0a1b3f] transition-colors uppercase cursor-pointer">
                                 <Share2 className="w-3.5 h-3.5" /> Share
                              </button>
                           </div>
                           {r.isPublished && (
                              <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-emerald-500 uppercase tracking-widest px-2 py-1 rounded">
                                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                 PUBLISHED
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               );
            })}
      </div>
    </div>
  );
}
