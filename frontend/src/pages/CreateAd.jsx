import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoIcon, SparklesIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { HeartIcon, ChatBubbleOvalLeftIcon, PaperAirplaneIcon, BookmarkIcon } from '@heroicons/react/24/outline';

export default function CreateAd() {
  const navigate = useNavigate();
  const [headline, setHeadline] = useState('Explore the magic of Dubai! ✈️');
  const [primaryText, setPrimaryText] = useState('Book your 5-day luxury tour with us today. Message us on WhatsApp for exclusive deals!');
  const [budget, setBudget] = useState('500');
  
  // Using a more reliable image from Pexels for the preview
  const [imagePreview, setImagePreview] = useState('https://images.pexels.com/photos/208736/pexels-photo-208736.jpeg?auto=compress&cs=tinysrgb&w=600');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLaunchCampaign = async () => {
    setIsSubmitting(true);
    // Simulate API Call
    setTimeout(() => {
      setIsSubmitting(false);
      navigate('/ads'); // Redirect back to dashboard safely
    }, 2000);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="mb-8">
        <button onClick={() => navigate('/ads')} className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center mb-4 transition-colors">
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Ads
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Ad Campaign</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
          Launch a high-converting Click-to-WhatsApp ad on Instagram and Facebook.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Column - Form */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-indigo-600" />
              Ad Content
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold leading-6 text-slate-900">
                  Ad Headline
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm leading-6 transition-shadow"
                    placeholder="e.g. 5-Day Bali Package!"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold leading-6 text-slate-900">
                  Primary Text (Description)
                </label>
                <div className="mt-2">
                  <textarea
                    rows={4}
                    value={primaryText}
                    onChange={(e) => setPrimaryText(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm leading-6 transition-shadow"
                    placeholder="Tell them why they should book..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold leading-6 text-slate-900">
                  Media (Image/Video)
                </label>
                <div className="mt-2 flex justify-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 hover:border-indigo-500 hover:bg-slate-50 transition-colors relative cursor-pointer group">
                  <div className="text-center">
                    <PhotoIcon className="mx-auto h-12 w-12 text-slate-400 group-hover:text-indigo-500 transition-colors" aria-hidden="true" />
                    <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-transparent font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-slate-500 mt-1">PNG, JPG, MP4 up to 10MB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Budget & Schedule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-semibold leading-6 text-slate-900">
                    Daily Budget (₹)
                  </label>
                  <div className="mt-2 relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <span className="text-slate-500 sm:text-sm font-semibold">₹</span>
                    </div>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="block w-full rounded-xl border-0 py-3 pl-8 pr-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm leading-6 transition-shadow"
                      placeholder="500"
                    />
                  </div>
               </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={handleLaunchCampaign}
                disabled={isSubmitting}
                className={`w-full rounded-xl bg-gradient-to-r from-blue-600 tracking-wide to-indigo-600 px-3.5 py-4 text-sm font-bold text-white shadow-md shadow-indigo-500/30 hover:from-blue-500 hover:to-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
              >
                {isSubmitting ? 'Launching Campaign...' : 'Launch Instagram & Facebook Ad'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Preview Box */}
        <div className="lg:col-span-5">
           <div className="sticky top-8">
             <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
                <div className="flex items-center justify-center mb-6">
                  <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">Instagram Feed Preview</span>
                </div>
                
                {/* Authentic Mobile Device Mockup */}
                <div className="bg-white mx-auto w-full max-w-[360px] rounded-sm shadow-xl overflow-hidden border border-slate-200/60 pb-2">
                  {/* Mock Insta Header */}
                  <div className="px-3 py-3 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-[2px]">
                         <div className="bg-white h-full w-full rounded-full flex items-center justify-center border-2 border-white">
                           <span className="text-[10px] font-bold text-slate-800">TB</span>
                         </div>
                       </div>
                       <div className="flex flex-col">
                         <p className="text-[13px] font-semibold text-slate-900 leading-tight flex items-center gap-1">TravelBot Agency <svg aria-label="Verified" className="x1lliihq x1n2onr6" fill="rgb(0, 149, 246)" height="12" role="img" viewBox="0 0 40 40" width="12"><title>Verified</title><path d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z" fillRule="evenodd"></path></svg></p>
                         <p className="text-[11px] text-slate-500 leading-tight">Sponsored</p>
                       </div>
                     </div>
                     <svg aria-label="More options" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>
                  </div>
                  
                  {/* Mock Post Image Edge-to-Edge */}
                  <div className="relative aspect-square w-full bg-slate-100 border-y border-slate-100">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Ad content" className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">Loading Image...</div>
                    )}
                  </div>

                  {/* CTWA Bar (Instagram Style) */}
                  <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[#e4e6e9] transition-colors">
                     <div className="flex flex-col max-w-[60%]">
                       <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5 tracking-wider">WhatsApp</p>
                       <p className="text-[13px] font-bold text-slate-900 truncate">{headline || 'Enter headline...'}</p>
                     </div>
                     <button className="bg-slate-900 text-white px-5 py-1.5 rounded-md text-[13px] font-semibold tracking-wide">
                       Send Message
                     </button>
                  </div>

                  {/* Mock Engagement Icons */}
                  <div className="px-3 pt-3 pb-1 flex justify-between items-center">
                    <div className="flex gap-4">
                      <HeartIcon className="h-[26px] w-[26px] text-slate-900 hover:text-slate-500 cursor-pointer transition-colors" />
                      <ChatBubbleOvalLeftIcon className="h-[26px] w-[26px] text-slate-900 hover:text-slate-500 cursor-pointer transition-colors" />
                      <PaperAirplaneIcon className="h-[26px] w-[26px] text-slate-900 hover:text-slate-500 cursor-pointer transition-colors -rotate-45 -mt-1" />
                    </div>
                    <BookmarkIcon className="h-[26px] w-[26px] text-slate-900 hover:text-slate-500 cursor-pointer transition-colors" />
                  </div>
                  
                  {/* Mock Caption */}
                  <div className="px-4 pb-4">
                     <p className="text-[13px] text-slate-900 leading-snug"><span className="font-bold mr-1.5">TravelBot Agency</span>{primaryText || 'Enter primary text...'}</p>
                  </div>
                </div>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
