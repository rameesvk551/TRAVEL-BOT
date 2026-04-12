// FILE: /frontend/src/pages/Customers.jsx

import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import { formatDate, formatPhone } from '../utils/formatters';
import { UsersIcon } from '@heroicons/react/24/outline';

export default function Customers() {
  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.get('/leads', { params: { pageSize: 200 } }).then((r) => r.data),
  });

  // Extract unique customers from leads
  const leads = data?.data?.data || [];
  const customerMap = new Map();
  leads.forEach((lead) => {
    if (lead.customer && !customerMap.has(lead.customer.id)) {
      customerMap.set(lead.customer.id, { ...lead.customer, leadCount: 1 });
    } else if (lead.customer) {
      customerMap.get(lead.customer.id).leadCount++;
    }
  });
  const customers = Array.from(customerMap.values());

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-sm text-surface-400 mt-0.5">{customers.length} customers</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Language</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Source</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Leads</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-400 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-surface-700/20 animate-pulse">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-surface-700/30 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-surface-500">
                  <UsersIcon className="w-8 h-8 mx-auto mb-2 text-surface-600" />
                  No customers yet
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-b border-surface-700/20 hover:bg-surface-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-xs font-medium text-brand-400">
                        {customer.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm text-white">{customer.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-300">{formatPhone(customer.phone)}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-new">{customer.language || 'EN'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-400">{customer.source}</td>
                  <td className="px-4 py-3 text-sm text-surface-300">{customer.leadCount}</td>
                  <td className="px-4 py-3 text-xs text-surface-400">{formatDate(customer.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
