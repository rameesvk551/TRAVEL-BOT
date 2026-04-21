import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, MegaphoneIcon, ChartBarIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

const dummyCampaigns = [
  { id: 1, name: 'Bali Summer Getaway', status: 'ACTIVE', spend: 450, leads: 34, image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=200' },
  { id: 2, name: 'Dubai Luxury Tour', status: 'PAUSED', spend: 120, leads: 12, image: 'https://images.unsplash.com/photo-1512453979436-5a50c640e704?auto=format&fit=crop&q=80&w=200' },
  { id: 3, name: 'Kerala Houseboats', status: 'ACTIVE', spend: 890, leads: 104, image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c4731?auto=format&fit=crop&q=80&w=200' },
];

export default function AdsDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">Social Ads</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">
            Launch stunning Click-to-WhatsApp ads on Instagram & Facebook directly from TravelBot. Convert scrollers into engaged travelers instantly.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Link
            to="/ads/new"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/30 hover:from-blue-500 hover:to-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all active:scale-95"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Create Ad Campaign
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MegaphoneIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-slate-500">Active Campaigns</dt>
                  <dd>
                    <div className="text-2xl font-bold text-slate-900">2</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-emerald-600" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-slate-500">Total Spend</dt>
                  <dd>
                    <div className="text-2xl font-bold text-slate-900">₹1,340</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowTrendingUpIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-slate-500">Total Ads Leads</dt>
                  <dd>
                    <div className="text-2xl font-bold text-slate-900">138</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4">
          <h3 className="text-base font-semibold leading-6 text-slate-900">Recent Ads</h3>
        </div>
        <ul role="list" className="divide-y divide-slate-100">
          {dummyCampaigns.map((campaign) => (
            <li key={campaign.id} className="flex items-center justify-between gap-x-6 py-5 px-6 hover:bg-slate-50 transition-colors">
              <div className="flex min-w-0 gap-x-4 items-center">
                <img className="h-16 w-16 flex-none rounded-lg object-cover" src={campaign.image} alt="" />
                <div className="min-w-0 flex-auto">
                  <p className="text-sm font-semibold leading-6 text-slate-900">{campaign.name}</p>
                  <p className="mt-1 flex text-xs leading-5 text-slate-500">
                     <span className="truncate">Click-to-WhatsApp Integration</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-x-6">
                <div className="hidden sm:flex sm:flex-col sm:items-end">
                  <p className="text-sm leading-6 text-slate-900">₹{campaign.spend} Spent</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {campaign.leads} WhatsApp Leads
                  </p>
                </div>
                {campaign.status === 'ACTIVE' ? (
                   <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                     Active
                   </span>
                 ) : (
                   <span className="inline-flex items-center rounded-md bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                     Paused
                   </span>
                 )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
