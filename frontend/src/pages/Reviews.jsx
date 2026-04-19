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
    <div className="w-full space-y-6 page-enter">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Panel - Avg Rating */}
        <div className="lg:col-span-2 section-card p-6">
           <div className="grid grid-cols-2 gap-8 items-center h-full">
              <div>
                 <p className="eyebrow mb-2">Average Rating</p>
                 <h1 className="text-[4rem] font-extrabold text-neutral-900 leading-none mb-2 tracking-tighter">
                   {stats.avgRating.toFixed(1)}
                 </h1>
                 <div className="flex gap-1 mb-3">
                   {[1,2,3,4,5].map(i => <Star key={i} className={`w-5 h-5 ${i <= Math.round(stats.avgRating) ? 'fill-amber-400 text-amber-400' : 'fill-neutral-200 text-neutral-200'}`} />)}
                 </div>
                 <p className="text-xs font-semibold text-neutral-400">Based on {stats.totalReviews.toLocaleString()} global reviews</p>
              </div>
              
              <div className="space-y-2.5 relative">
                 {[5,4,3,2,1].map(r => {
                      const item = stats.distribution.find(d => parseInt(d.rating) === r) || { count: 0 };
                      const pct = stats.totalReviews > 0 ? (item.count / stats.totalReviews) * 100 : 0;
                      const barColors = {
                        5: 'bg-emerald-500',
                        4: 'bg-sky-500',
                        3: 'bg-amber-500',
                        2: 'bg-orange-500',
                        1: 'bg-rose-500',
                      };
                      return (
                        <div key={r} className="flex items-center gap-4 text-xs font-bold">
                           <span className="w-12 text-neutral-600">{r} Star</span>
                           <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                              <div className={`h-full ${barColors[r]} rounded-full transition-all duration-500`} style={{width: `${pct}%`}}></div>
                           </div>
                           <span className="w-10 text-right text-neutral-400">{Math.round(pct)}%</span>
                        </div>
                      )
                 })}
                 <div className="pt-3 text-right">
                    <button className="text-[11px] font-bold text-indigo-600 uppercase flex items-center justify-end w-full gap-1 hover:text-indigo-700 tracking-wider transition-colors">
                      View Segmentation &rarr;
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Panels */}
        <div className="space-y-4 flex flex-col">
           {/* Total Collected */}
           <div className="kpi-card flex-1 flex flex-col justify-center">
              <div className="flex items-start justify-between">
                <div className="kpi-icon bg-sky-50 text-sky-600 mb-3">
                   <Database className="w-5 h-5" strokeWidth={2.5} /> 
                </div>
                <span className="badge bg-emerald-50 text-emerald-700">
                   +12.4%
                </span>
              </div>
              <p className="eyebrow mb-1">Total Collected</p>
              <h2 className="text-2xl font-extrabold text-neutral-900">{stats.totalReviews.toLocaleString()}</h2>
           </div>

           {/* Published & Approved */}
           <div className="rounded-[var(--radius-lg)] bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white relative flex flex-col justify-center shadow-lg shadow-indigo-500/20 flex-1">
              <div className="kpi-icon bg-white/10 backdrop-blur-sm mb-3">
                 <BadgeCheck className="w-5 h-5 text-white/90" strokeWidth={2.5} />
              </div>
              <div className="absolute top-5 right-5 bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide backdrop-blur-sm">
                 STABLE
              </div>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Published & Approved</p>
              <h2 className="text-2xl font-extrabold">{stats.publishedCount.toLocaleString()}</h2>
           </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex bg-neutral-100 p-1 rounded-[var(--radius-md)] gap-1 border border-neutral-200">
          {['All Reviews', '5 Stars', '4 Stars', '3 Stars', 'Negative'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all tracking-wide ${filter === f ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-800 hover:bg-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="shell-button-ghost text-xs font-bold tracking-widest uppercase">
          <Filter className="w-4 h-4" /> Advanced Filters
        </button>
      </div>

      <div className="space-y-4">
         {isLoading ? <div className="p-8 text-neutral-400 text-center font-medium">Loading insights...</div> : null}
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

               // Color-code the star ratings
               const ratingColor = r.rating >= 4 ? 'fill-amber-400 text-amber-400' : r.rating >= 3 ? 'fill-amber-300 text-amber-300' : 'fill-rose-400 text-rose-400';

               return (
                  <div key={r.id} className="section-card p-6 flex gap-8 hover:shadow-lg hover:shadow-black/[0.04] transition-all group cursor-pointer">
                     {/* Author info (Left) */}
                     <div className="w-48 flex-shrink-0 flex gap-4">
                        <div className="w-10 h-10 bg-neutral-100 text-neutral-600 rounded-full flex items-center justify-center font-bold text-xs tracking-wider ring-1 ring-neutral-200">
                           {initials}
                        </div>
                        <div className="pt-0.5">
                           <h3 className="font-bold text-xs text-neutral-900 mb-1">{r.customer?.name || 'Unknown User'}</h3>
                           <p className="text-[10px] text-neutral-400 font-semibold mb-2">{formatDate(r.createdAt)}</p>
                           <div className="flex">
                              {[...Array(r.rating)].map((_,i) => <Star key={i} className={`w-3.5 h-3.5 ${ratingColor}`} />)}
                              {[...Array(5 - r.rating)].map((_,i) => <Star key={i} className="w-3.5 h-3.5 text-neutral-200 fill-neutral-200" />)}
                           </div>
                        </div>
                     </div>
                     
                     {/* Review text (Middle/Right) */}
                     <div className="flex-1 flex flex-col">
                        <h4 className="font-extrabold text-neutral-900 text-[15px] mb-2 leading-tight">
                           {title}
                        </h4>
                        <p className="text-neutral-500 text-sm leading-relaxed mb-6 font-medium">
                           {desc}
                        </p>
                        
                        <div className="flex items-center justify-between mt-auto">
                           <div className="flex items-center gap-6 text-[10px] font-bold text-neutral-400 tracking-wider">
                              <button className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors uppercase cursor-pointer">
                                 <Reply className="w-3.5 h-3.5" /> Respond
                              </button>
                              <button className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors uppercase cursor-pointer">
                                 <Share2 className="w-3.5 h-3.5" /> Share
                              </button>
                           </div>
                           {r.isPublished && (
                              <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-emerald-700 uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50">
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
