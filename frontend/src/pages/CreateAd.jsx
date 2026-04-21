import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoIcon, CheckCircleIcon, SparklesIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';

export default function CreateAd() {
  const navigate = useNavigate();
  const [headline, setHeadline] = useState('Explore the magic of Dubai! ✈️');
  const [primaryText, setPrimaryText] = useState('Book your 5-day luxury tour with us today. Message us on WhatsApp for exclusive deals!');
  const [budget, setBudget] = useState('500');
  const [imagePreview, setImagePreview] = useState('https://images.unsplash.com/photo-1512453979436-5a50c640e704?auto=format&fit=crop&q=80&w=600');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLaunchCampaign = async () => {
    setIsSubmitting(true);
    // Simulate API Call
    setTimeout(() => {
      setIsSubmitting(false);
      navigate('/ads'); // Redirect back to dashboard safely
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="mb-6">
        <button onClick={() => navigate('/ads')} className="text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center mb-4 transition-colors">
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Ads
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Ad Campaign</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
          Launch a high-converting Click-to-WhatsApp ad on Instagram and Facebook.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column - Form */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-indigo-600" />
              Ad Content
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium leading-6 text-slate-900">
                  Ad Headline
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm leading-6"
                    placeholder="e.g. 5-Day Bali Package!"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium leading-6 text-slate-900">
                  Primary Text (Description)
                </label>
                <div className="mt-2">
                  <textarea
                    rows={3}
                    value={primaryText}
                    onChange={(e) => setPrimaryText(e.target.value)}
                    className="block w-full rounded-xl border-0 py-2.5 px-3.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm leading-6"
                    placeholder="Tell them why they should book..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium leading-6 text-slate-900">
                  Media (Image/Video)
                </label>
                <div className="mt-2 flex justify-center rounded-xl border border-dashed border-slate-300 px-6 py-8 hover:border-indigo-500 transition-colors cursor-pointer bg-slate-50/50">
                  <div className="text-center">
                    <PhotoIcon className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
                    <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                      <span className="relative cursor-pointer rounded-md bg-transparent font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                        Upload a file
                      </span>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-slate-500">PNG, JPG, MP4 up to 10MB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Budget & Schedule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-medium leading-6 text-slate-900">
                    Daily Budget (₹)
                  </label>
                  <div className="mt-2 relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-500 sm:text-sm">₹</span>
                    </div>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="block w-full rounded-xl border-0 py-2.5 pl-7 pr-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm leading-6"
                      placeholder="500"
                    />
                  </div>
               </div>
            </div>
            
            <div className="mt-8">
              <button
                type="button"
                onClick={handleLaunchCampaign}
                disabled={isSubmitting}
                className={`w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-500/30 hover:from-blue-500 hover:to-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
              >
                {isSubmitting ? 'Launching Campaign...' : 'Launch Instagram & Facebook Ad'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Preview Box */}
        <div className="lg:col-span-5">
           <div className="sticky top-8">
             <div className="bg-slate-100 rounded-3xl p-4 sm:p-6 shadow-inner ring-1 ring-slate-200/50">
                <div className="flex items-center justify-center mb-4 gap-2">
                  <span className="text-sm font-semibold text-slate-500 tracking-wide uppercase">Ad Preview</span>
                </div>
                
                {/* Mobile Device Mockup */}
                <div className="bg-white mx-auto w-full max-w-[340px] rounded-[2rem] shadow-xl overflow-hidden ring-1 ring-slate-200">
                  {/* Mock Insta Header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                     <div className="flex items-center gap-2">
                       <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">TB</div>
                       <div>
                         <p className="text-sm font-bold text-slate-900 leading-none">TravelBot Agency</p>
                         <p className="text-xs text-slate-500">Sponsored</p>
                       </div>
                     </div>
                  </div>
                  
                  {/* Mock Post Content */}
                  <div className="relative aspect-square bg-slate-100">
                    <img src={imagePreview} alt="Ad preview" className="object-cover w-full h-full" />
                  </div>

                  {/* Mock CTA Footer */}
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                     <div>
                       <p className="text-xs text-slate-500 uppercase font-semibold">WhatsApp</p>
                       <p className="text-sm font-bold text-slate-900">{headline || 'Enter headline...'}</p>
                     </div>
                     <button className="bg-green-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                       Send Message
                     </button>
                  </div>
                  
                  {/* Mock Caption */}
                  <div className="px-4 py-3">
                     <p className="text-sm text-slate-800"><span className="font-bold mr-1">TravelBot Agency</span>{primaryText || 'Enter primary text...'}</p>
                  </div>
                </div>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
