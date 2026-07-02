import React, { useState, useEffect } from 'react';
import api from '../../api/client';

export default function VendorForm({ vendor, onClose, onSuccess }) {
  const [vendorTypes, setVendorTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: vendor?.name || '',
    type: vendor?.type || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    gstin: vendor?.gstin || '',
    address: vendor?.address || '',
    isActive: vendor ? vendor.isActive : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fetch vendor types dynamically
  useEffect(() => {
    api.get('/vendor-types', { params: { isActive: true } })
      .then((res) => {
        const types = res.data || [];
        setVendorTypes(types);
        // Set default type if creating new vendor and types are available
        if (!vendor && types.length > 0 && !formData.type) {
          setFormData((prev) => ({ ...prev, type: types[0].name }));
        }
      })
      .catch(() => {
        // Fallback if API fails
        setVendorTypes([{ name: 'OTHER' }]);
      })
      .finally(() => setTypesLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (vendor) {
        // Assuming we add a PUT route later if needed, but for now we might not have it.
        // Let's implement creating primarily.
        await api.put(`/vendors/${vendor.id}`, formData);
      } else {
        await api.post('/vendors', formData);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-neutral-900">
          {vendor ? 'Edit Vendor' : 'Add New Vendor'}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Name *</label>
            <input
              type="text"
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Type *</label>
            <select
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              {typesLoading ? (
                <option value="">Loading types...</option>
              ) : vendorTypes.length === 0 ? (
                <option value="">No types available — create one in Settings</option>
              ) : (
                vendorTypes.map(t => (
                  <option key={t.name || t} value={t.name || t}>{t.name || t}</option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Phone</label>
              <input
                type="tel"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">GSTIN</label>
            <input
              type="text"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-[#00A884] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
