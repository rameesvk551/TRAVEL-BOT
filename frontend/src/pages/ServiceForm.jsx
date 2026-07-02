import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRightIcon, ChevronLeftIcon, XMarkIcon, PlusIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { servicesApi } from '../api/servicesApi';

/* ── Icon options for the picker ── */
const ICON_OPTIONS = [
  { key: 'plane', emoji: '✈️', label: 'Flight' },
  { key: 'train', emoji: '🚂', label: 'Train' },
  { key: 'document', emoji: '📄', label: 'Document' },
  { key: 'globe', emoji: '🌍', label: 'Visa/Passport' },
  { key: 'shield', emoji: '🛡️', label: 'Insurance' },
  { key: 'car', emoji: '🚗', label: 'Transport' },
  { key: 'hotel', emoji: '🏨', label: 'Hotel' },
  { key: 'stamp', emoji: '📝', label: 'Attestation' },
  { key: 'file', emoji: '📁', label: 'Application' },
  { key: 'default', emoji: '⚙️', label: 'General' },
];

const CATEGORY_OPTIONS = [
  { value: 'TICKETING', label: 'Ticketing' },
  { value: 'DOCUMENTATION', label: 'Documentation' },
  { value: 'VISA', label: 'Visa' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'OTHER', label: 'Other' },
];

const PRICING_TYPES = [
  { value: 'FIXED', label: 'Fixed Price', description: 'Set a specific price' },
  { value: 'STARTING_FROM', label: 'Starting From', description: 'Minimum price, may vary' },
  { value: 'VARIABLE', label: 'Variable', description: 'Contact for pricing' },
];

const INITIAL_FORM = {
  name: '',
  category: 'TICKETING',
  description: '',
  icon: 'default',
  pricingType: 'FIXED',
  price: '',
  features: [],
  isActive: true,
};

export default function ServiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [newFeature, setNewFeature] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── Fetch existing service in edit mode ── */
  const serviceQuery = useQuery({
    queryKey: ['service', id],
    queryFn: () => servicesApi.getById(id),
    enabled: isEdit,
  });

  const serviceData = serviceQuery.data?.data;

  useEffect(() => {
    if (!isEdit) {
      setForm({ ...INITIAL_FORM });
      setError('');
      setSuccess('');
      return;
    }
    if (!serviceData) return;
    setForm({
      name: serviceData.name || '',
      category: serviceData.category || 'TICKETING',
      description: serviceData.description || '',
      icon: serviceData.icon || 'default',
      pricingType: serviceData.pricingType || 'FIXED',
      price: serviceData.basePrice ? String(serviceData.basePrice / 100) : '',
      features: serviceData.features || [],
      isActive: serviceData.isActive !== false,
    });
    setError('');
    setSuccess('');
  }, [isEdit, serviceData]);

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? servicesApi.update(id, data) : servicesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      setSuccess(isEdit ? 'Service updated successfully!' : 'Service created successfully!');
      setTimeout(() => navigate('/services'), 800);
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to save service'),
  });

  /* ── Helpers ── */
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const addFeature = () => {
    const trimmed = newFeature.trim();
    if (!trimmed) return;
    setForm((f) => ({ ...f, features: [...f.features, trimmed] }));
    setNewFeature('');
  };

  const removeFeature = (index) => {
    setForm((f) => ({ ...f, features: f.features.filter((_, i) => i !== index) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Service name is required');
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      icon: form.icon,
      pricingType: form.pricingType,
      basePrice: (form.pricingType === 'FIXED' || form.pricingType === 'STARTING_FROM') && form.price
        ? Math.round(Number(form.price) * 100)
        : null,
      features: form.features.filter(Boolean),
      isActive: form.isActive,
    };

    saveMutation.mutate(payload);
  };

  const handleFeatureKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature();
    }
  };

  /* ── Loading state for edit ── */
  if (isEdit && serviceQuery.isLoading) {
    return (
      <div className="w-full p-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-neutral-200 mb-6" />
        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="h-12 rounded-xl bg-neutral-100" />
          <div className="h-12 rounded-xl bg-neutral-100" />
          <div className="h-32 rounded-xl bg-neutral-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="prop-wizard">
      {/* ── Sidebar Navigation ── */}
      <div className="prop-wizard-sidebar">
        <button
          type="button"
          onClick={() => navigate('/services')}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition mb-6 w-fit"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="text-sm font-bold">Back to Services</span>
        </button>

        <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-2 tracking-tight">
          {isEdit ? 'Edit Service' : 'New Service'}
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          Fill in the details for your service offering.
        </p>
        
        <div className="pt-8 border-t border-neutral-200 hidden md:block">
          <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm font-bold text-neutral-900">{form.isActive ? 'Active' : 'Draft'}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{form.isActive ? 'Visible to customers' : 'Hidden'}</p>
            </div>
            <div
              className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.isActive ? 'bg-neutral-900' : 'bg-neutral-300'}`}
              onClick={() => setForm(prev => ({...prev, isActive: !prev.isActive}))}
            >
              <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.isActive ? 'translate-x-[26px]' : 'translate-x-1'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="prop-wizard-body relative">
        <div className="max-w-3xl mx-auto">
          {/* Error / Success */}
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 shadow-sm">
              <XMarkIcon className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 shadow-sm">
              <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
              {success}
            </div>
          )}

          <div className="prop-wizard-step">
            <h2 className="text-2xl font-bold text-neutral-900 mb-5">Service Details</h2>
            <div className="prop-wizard-fields">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                <div>
                  <label className="prop-label">Service Name <span className="text-red-400">*</span></label>
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. Flight Ticket Booking"
                    required
                    className="prop-input"
                  />
                </div>
                <div>
                  <label className="prop-label">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                    className="prop-input"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="prop-label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Briefly describe what this service includes..."
                  rows={2}
                  className="prop-input resize-none py-4"
                />
              </div>

              <div>
                <label className="prop-label">Icon</label>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-3">
                  {ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => set('icon', opt.key)}
                      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center transition-all duration-300 ${
                        form.icon === opt.key
                          ? 'border-neutral-900 bg-neutral-50 shadow-sm scale-105'
                          : 'border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="text-2xl drop-shadow-sm">{opt.emoji}</span>
                      <span className="text-[10px] font-bold text-neutral-500 leading-tight truncate w-full">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="prop-label">Pricing Type</label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {PRICING_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => set('pricingType', pt.value)}
                      className={`flex flex-col items-start rounded-2xl border-2 p-5 text-left transition-all duration-300 ${
                        form.pricingType === pt.value
                          ? 'border-neutral-900 bg-neutral-50 shadow-sm scale-[1.02]'
                          : 'border-neutral-200 bg-white hover:border-neutral-400'
                      }`}
                    >
                      <span className="text-sm font-bold text-neutral-900 mb-1">{pt.label}</span>
                      <span className="text-[11px] font-medium text-neutral-500">{pt.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(form.pricingType === 'FIXED' || form.pricingType === 'STARTING_FROM') && (
                <div>
                  <label className="prop-label">
                    {form.pricingType === 'STARTING_FROM' ? 'Starting Price (INR)' : 'Price (INR)'}
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    placeholder="e.g. 1500"
                    min="0"
                    step="1"
                    className="prop-input"
                  />
                  <p className="mt-2 text-xs font-medium text-neutral-400">Enter the amount in rupees</p>
                </div>
              )}

              <div className="pt-6 border-t border-neutral-100">
                <label className="prop-label flex items-center gap-2 mb-4">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-500" /> Features
                </label>
                {form.features.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {form.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm transition hover:border-neutral-300">
                        <span className="flex-1 text-sm font-medium text-neutral-800">{feature}</span>
                        <button
                          type="button"
                          onClick={() => removeFeature(idx)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 transition hover:bg-red-500 hover:text-white"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={handleFeatureKeyDown}
                    placeholder="e.g. 24/7 Support"
                    className="prop-input !mb-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-3.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 hover:border-neutral-400 shadow-sm active:scale-95"
                  >
                    <PlusIcon className="h-5 w-5" /> Add
                  </button>
                </div>
              </div>

              {/* Mobile Active Toggle */}
              <div className="md:hidden mt-8 pt-8 border-t border-neutral-200">
                <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{form.isActive ? 'Active' : 'Draft'}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{form.isActive ? 'Visible to customers' : 'Hidden'}</p>
                  </div>
                  <div
                    className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.isActive ? 'bg-neutral-900' : 'bg-neutral-300'}`}
                    onClick={() => setForm(prev => ({...prev, isActive: !prev.isActive}))}
                  >
                    <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.isActive ? 'translate-x-[26px]' : 'translate-x-1'}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bottom navigation ── */}
          <div className="prop-wizard-footer">
            <button type="button" onClick={() => navigate('/services')} className="prop-btn-back">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              className="prop-btn-publish"
            >
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Service' : 'Publish Service'}
              {!saveMutation.isPending && <CheckCircleIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
