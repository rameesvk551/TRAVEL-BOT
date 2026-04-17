import React, { useState } from 'react';
import { Star, MessageCircle, Navigation2, CheckCircle2 } from 'lucide-react';
import { useReviews, useReviewStats } from '../hooks/useReviews';
import { formatDate } from '../utils/formatters';

export default function Reviews() {
  const [filter, setFilter] = useState('ALL');
  const { data: listData, isLoading } = useReviews();
  const { data: statsData } = useReviewStats();
  
  const reviews = listData?.data || [];
  const stats = statsData?.data || { totalReviews: 0, avgRating: 0, publishedCount: 0, distribution: [] };

  return (
   <div className="p-8 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Reviews</h1>
          <p className="text-slate-500 mt-1">Testimonials gathered after trips complete.</p>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="shell-panel p-6 col-span-2 flex items-center gap-8 bg-gradient-to-br from-yellow-400 to-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
            <div className="text-center">
               <p className="text-amber-100 font-medium mb-1">Average Rating</p>
               <h1 className="text-5xl font-extrabold">{stats.avgRating}</h1>
               <div className="flex text-white mt-2 justify-center">
                  {[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= Math.round(stats.avgRating) ? 'fill-white' : 'opacity-30 fill-transparent'}`} />)}
               </div>
            </div>
            
            <div className="flex-1 border-l border-amber-300/30 pl-8 space-y-2">
               {[5,4,3,2,1].map(r => {
                  const item = stats.distribution.find(d => d.rating === r) || { count: 0 };
                  const pct = stats.totalReviews > 0 ? (item.count / stats.totalReviews) * 100 : 0;
                  return (
                     <div key={r} className="flex items-center gap-3 text-sm font-medium">
                        <span className="w-12 text-amber-100">{r} Star</span>
                        <div className="flex-1 h-2 bg-amber-500/30 rounded-full overflow-hidden">
                           <div className="h-full bg-white rounded-full" style={{width: `${pct}%`}}></div>
                        </div>
                        <span className="w-8 text-right text-amber-100">{item.count}</span>
                     </div>
                  )
               })}
            </div>
         </div>

         <div className="shell-panel p-6 flex flex-col justify-center">
            <MessageCircle className="w-8 h-8 text-blue-500 mb-3" />
            <p className="text-slate-500 font-medium text-sm">Total Reviews Collected</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalReviews}</p>
         </div>

         <div className="shell-panel p-6 flex flex-col justify-center border-b-4 border-teal-500">
            <CheckCircle2 className="w-8 h-8 text-teal-500 mb-3" />
            <p className="text-slate-500 font-medium text-sm">Published & Approved</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stats.publishedCount}</p>
         </div>
      </div>

      <div className="flex gap-2">
         {['ALL', '5', '4', '3', '2', '1', 'PUBLISHED'].map(f => (
            <button 
               key={f}
               onClick={() => setFilter(f)}
               className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${filter === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
               {f === 'ALL' ? 'All Reviews' : f === 'PUBLISHED' ? 'Published Only' : `${f} Stars`}
            </button>
         ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {isLoading ? <div className="p-8 text-slate-500">Loading reviews...</div> : null}
         {reviews
            .filter(r => filter === 'ALL' || (filter === 'PUBLISHED' && r.isPublished) || r.rating.toString() === filter)
            .map(r => (
               <div key={r.id} className="shell-panel p-6 flex flex-col hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between w-full mb-3">
                     <div className="flex text-amber-500">
                        {[...Array(r.rating)].map((_,i) => <Star key={i} className="w-4 h-4 fill-amber-500" />)}
                        {[...Array(5 - r.rating)].map((_,i) => <Star key={i} className="w-4 h-4 text-slate-200" />)}
                     </div>
                     <span className="text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                  </div>
                  
                  {r.testimonial ? (
                     <p className="text-slate-700 font-medium italic text-[15px] leading-relaxed flex-1">"{r.testimonial}"</p>
                  ) : (
                     <p className="text-slate-400 italic text-sm flex-1">No testimonial provided. Only rating submitted.</p>
                  )}
                  
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                     <div className="min-w-0 flex-1 pr-4">
                        <p className="font-bold text-slate-900 truncate">{r.customer?.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 truncate mt-0.5">
                           <Navigation2 className="w-3 h-3 flex-shrink-0" />
                           {r.destination || r.booking?.bookingRef || 'General System'}
                        </p>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" title="Publish for marketing">
                        <input type="checkbox" className="sr-only peer" checked={r.isPublished} readOnly />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[16px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                     </label>
                  </div>
               </div>
         ))}
      </div>
    </div>
  );
}
