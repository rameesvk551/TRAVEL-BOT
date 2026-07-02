import React, { useState, useEffect } from 'react';
import { PlusIcon, CurrencyRupeeIcon } from '@heroicons/react/24/outline';
import api from '../../api/client';
import VendorForm from './VendorForm';
import VendorPayments from './VendorPayments';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data } = await api.get('/vendors');
      setVendors(data);
    } catch (error) {
      console.error('Failed to fetch vendors', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedVendor(null);
    setShowForm(true);
  };

  const handleEdit = (vendor) => {
    setSelectedVendor(vendor);
    setShowForm(true);
  };

  const handlePayments = (vendor) => {
    setSelectedVendor(vendor);
    setShowPayments(true);
  };

  if (loading) return <div className="p-6">Loading vendors...</div>;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Vendors</h1>
          <p className="text-sm text-neutral-500">Manage your suppliers and service providers.</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
        >
          <PlusIcon className="h-5 w-5" />
          Add Vendor
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {vendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-neutral-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="font-medium text-neutral-900">{vendor.name}</div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800">
                    {vendor.type}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-500">
                  {vendor.phone || vendor.email || '-'}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      vendor.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {vendor.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <button
                    onClick={() => handlePayments(vendor)}
                    className="text-[#00A884] hover:text-[#008f6f] mr-4 inline-flex items-center gap-1"
                  >
                    <CurrencyRupeeIcon className="h-4 w-4" />
                    Payments
                  </button>
                  <button
                    onClick={() => handleEdit(vendor)}
                    className="text-neutral-600 hover:text-neutral-900"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-sm text-neutral-500">
                  No vendors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <VendorForm
          vendor={selectedVendor}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            fetchVendors();
          }}
        />
      )}

      {showPayments && selectedVendor && (
        <VendorPayments
          vendor={selectedVendor}
          onClose={() => setShowPayments(false)}
        />
      )}
    </div>
  );
}
