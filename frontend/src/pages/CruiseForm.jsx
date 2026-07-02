// FILE: /frontend/src/pages/CruiseForm.jsx

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cruisesApi } from '../api/cruisesApi';
import {
  ArrowLeftIcon,
  PhotoIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basics', label: 'Basic Info' },
  { id: 'details', label: 'Inclusions & Exclusions' },
  { id: 'cabins', label: 'Cabin Types' },
];

export default function CruiseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [activeTab, setActiveTab] = useState('basics');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const [form, setForm] = useState({
    name: '',
    cruiseLine: '',
    departurePort: '',
    destinations: '',
    duration: '',
    basePrice: '',
    imageUrl: '',
    departureDate: '',
    capacity: '',
    summary: '',
    inclusions: '',
    exclusions: '',
    cabinTypes: [],
    isActive: true,
  });

  // Fetch cruise in edit mode
  const { data: cruiseData, isLoading: loadingCruise } = useQuery({
    queryKey: ['cruise', id],
    queryFn: () => cruisesApi.getById(id),
    enabled: isEdit,
  });

  // Load data into form
  useEffect(() => {
    if (cruiseData?.success && cruiseData?.data) {
      const cruise = cruiseData.data;
      setForm({
        name: cruise.name || '',
        cruiseLine: cruise.cruiseLine || '',
        departurePort: cruise.departurePort || '',
        destinations: cruise.destinations?.join(', ') || '',
        duration: cruise.duration || '',
        basePrice: cruise.basePrice ? (cruise.basePrice / 100).toString() : '',
        imageUrl: cruise.imageUrl || '',
        departureDate: cruise.departureDate ? new Date(cruise.departureDate).toISOString().split('T')[0] : '',
        capacity: cruise.capacity ? cruise.capacity.toString() : '',
        summary: cruise.summary || '',
        inclusions: Array.isArray(cruise.inclusions) ? cruise.inclusions.join('\n') : '',
        exclusions: Array.isArray(cruise.exclusions) ? cruise.exclusions.join('\n') : '',
        cabinTypes: Array.isArray(cruise.cabinTypes)
          ? cruise.cabinTypes.map((c) => ({
              ...c,
              price: c.price ? (c.price / 100).toString() : '',
            }))
          : [],
        isActive: cruise.isActive !== false,
      });
      setImagePreview(cruise.imageUrl || '');
    }
  }, [cruiseData]);

  // Image Upload handler
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    try {
      setUploadingImage(true);
      const res = await cruisesApi.uploadImage(file);
      if (res.success && res.data?.url) {
        setForm((prev) => ({ ...prev, imageUrl: res.data.url }));
      }
    } catch (err) {
      console.error('Image upload failed', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Cabin Types operations
  const addCabinType = () => {
    setForm((prev) => ({
      ...prev,
      cabinTypes: [...prev.cabinTypes, { name: '', price: '', description: '' }],
    }));
  };

  const removeCabinType = (index) => {
    setForm((prev) => ({
      ...prev,
      cabinTypes: prev.cabinTypes.filter((_, idx) => idx !== index),
    }));
  };

  const updateCabinType = (index, field, value) => {
    setForm((prev) => {
      const list = [...prev.cabinTypes];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, cabinTypes: list };
    });
  };

  // Submit Mutation
  const saveMutation = useMutation({
    mutationFn: (data) => (isEdit ? cruisesApi.update(id, data) : cruisesApi.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cruises'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['cruise', id] });
      navigate('/cruises');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.name) {
      alert('Please fill in the Cruise Name.');
      return;
    }

    // Prepare payload
    const payload = {
      ...form,
      basePrice: form.basePrice ? Math.round(parseFloat(form.basePrice) * 100) : null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      destinations: form.destinations
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      inclusions: form.inclusions
        .split('\n')
        .map((i) => i.trim())
        .filter(Boolean),
      exclusions: form.exclusions
        .split('\n')
        .map((e) => e.trim())
        .filter(Boolean),
      cabinTypes: form.cabinTypes.map((c) => ({
        name: c.name,
        price: c.price ? Math.round(parseFloat(c.price) * 100) : null,
        description: c.description || '',
      })),
      departureDate: form.departureDate ? new Date(form.departureDate).toISOString() : null,
    };

    saveMutation.mutate(payload);
  };

  if (isEdit && loadingCruise) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="prop-wizard">
      {/* ── Sidebar Navigation ── */}
      <div className="prop-wizard-sidebar">
        <button
          type="button"
          onClick={() => navigate('/cruises')}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition mb-6 w-fit"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span className="text-sm font-bold">Back to Cruises</span>
        </button>

        <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-2 tracking-tight">
          {isEdit ? 'Edit Cruise' : 'New Cruise'}
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          Provide itinerary and pricing details for the cruise package.
        </p>

        <div className="space-y-4 hidden md:block">
          {TABS.map((tab, idx) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left rounded-xl px-4 py-3 font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-neutral-900 text-white shadow-md'
                  : 'bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white text-neutral-900' : 'bg-neutral-100 text-neutral-400'}`}>
                  {idx + 1}
                </span>
                {tab.label}
              </div>
            </button>
          ))}
          
          <div className="pt-8 mt-8 border-t border-neutral-200">
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

      {/* ── Main Content ── */}
      <div className="prop-wizard-body relative">
        <div className="max-w-3xl mx-auto">
          {/* TAB: Basics */}
          {activeTab === 'basics' && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">Basic Information</h2>
              <div className="prop-wizard-fields">
                <div>
                  <label className="prop-label">Cruise Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Exotic Mediterranean Journey"
                    className="prop-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="prop-label">Cruise Line</label>
                    <input
                      type="text"
                      value={form.cruiseLine}
                      onChange={(e) => setForm((prev) => ({ ...prev, cruiseLine: e.target.value }))}
                      placeholder="e.g. Royal Caribbean"
                      className="prop-input"
                    />
                  </div>
                  <div>
                    <label className="prop-label">Departure Port</label>
                    <input
                      type="text"
                      value={form.departurePort}
                      onChange={(e) => setForm((prev) => ({ ...prev, departurePort: e.target.value }))}
                      placeholder="e.g. Port of Barcelona"
                      className="prop-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="prop-label">Duration</label>
                    <input
                      type="text"
                      value={form.duration}
                      onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g. 7 Nights / 8 Days"
                      className="prop-input"
                    />
                  </div>
                  <div>
                    <label className="prop-label">Base Price (INR)</label>
                    <input
                      type="number"
                      value={form.basePrice}
                      onChange={(e) => setForm((prev) => ({ ...prev, basePrice: e.target.value }))}
                      placeholder="e.g. 45000"
                      className="prop-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="prop-label">Departure Date</label>
                    <input
                      type="date"
                      value={form.departureDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, departureDate: e.target.value }))}
                      className="prop-input text-neutral-600"
                    />
                  </div>
                  <div>
                    <label className="prop-label">Capacity (Guests)</label>
                    <input
                      type="number"
                      value={form.capacity}
                      onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
                      placeholder="e.g. 2400"
                      className="prop-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="prop-label">Destinations (comma-separated)</label>
                  <input
                    type="text"
                    value={form.destinations}
                    onChange={(e) => setForm((prev) => ({ ...prev, destinations: e.target.value }))}
                    placeholder="e.g. Rome, Athens, Mykonos"
                    className="prop-input"
                  />
                </div>

                <div>
                  <label className="prop-label">Summary</label>
                  <textarea
                    value={form.summary}
                    onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                    placeholder="Describe the cruise highlights..."
                    rows={3}
                    className="prop-input resize-none py-4"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: Details */}
          {activeTab === 'details' && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">Inclusions & Exclusions</h2>
              <div className="prop-wizard-fields">
                {/* Image Upload */}
                <div>
                  <label className="prop-label mb-4">Cruise Cover Image</label>
                  <div className={`relative group overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
                    imagePreview
                      ? 'border-neutral-300 bg-neutral-50/30'
                      : 'border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100'
                  }`}>
                    {imagePreview ? (
                      <div className="relative aspect-[21/9]">
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                        <label className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-white opacity-0 hover:opacity-100 transition cursor-pointer backdrop-blur-sm">
                          Change Image
                          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center py-16 cursor-pointer">
                        <div className="h-16 w-16 rounded-full bg-white shadow-sm border border-neutral-200 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                          <PhotoIcon className="h-8 w-8 text-neutral-400" />
                        </div>
                        <span className="text-sm font-bold text-neutral-700">Upload Photo</span>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                    )}
                  </div>
                  {uploadingImage && <p className="mt-3 text-xs font-bold text-indigo-600 animate-pulse">Uploading...</p>}
                </div>

                {/* Inclusions */}
                <div>
                  <label className="prop-label flex items-center gap-2 mb-4">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" /> Inclusions
                  </label>
                  <textarea
                    value={form.inclusions}
                    onChange={(e) => setForm((prev) => ({ ...prev, inclusions: e.target.value }))}
                    placeholder="e.g. Free Wi-Fi&#10;Unlimited dining&#10;Daily entertainment shows"
                    rows={4}
                    className="prop-input resize-none py-4"
                  />
                  <p className="mt-2 text-xs font-medium text-neutral-400">One item per line.</p>
                </div>

                {/* Exclusions */}
                <div>
                  <label className="prop-label flex items-center gap-2 mb-4">
                    <XMarkIcon className="h-5 w-5 text-red-500" /> Exclusions
                  </label>
                  <textarea
                    value={form.exclusions}
                    onChange={(e) => setForm((prev) => ({ ...prev, exclusions: e.target.value }))}
                    placeholder="e.g. Port taxes&#10;Spa treatments&#10;Alcoholic beverages"
                    rows={4}
                    className="prop-input resize-none py-4"
                  />
                  <p className="mt-2 text-xs font-medium text-neutral-400">One item per line.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Cabins */}
          {activeTab === 'cabins' && (
            <div className="prop-wizard-step">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
                <h2 className="text-2xl font-bold text-neutral-900">Cabin Options</h2>
                <button
                  type="button"
                  onClick={addCabinType}
                  className="flex items-center gap-2 text-sm font-bold bg-neutral-900 text-white px-4 py-2 rounded-xl shadow-md hover:bg-neutral-800 transition active:scale-95"
                >
                  <PlusIcon className="h-4 w-4" /> Add Option
                </button>
              </div>

              {form.cabinTypes.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-3xl bg-neutral-50">
                  <p className="text-sm text-neutral-500 font-bold mb-1">No custom cabins added.</p>
                  <p className="text-xs text-neutral-400">They will inherit the base price if left empty.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {form.cabinTypes.map((cabin, idx) => (
                    <div key={idx} className="p-6 bg-white rounded-3xl border border-neutral-200 shadow-sm relative space-y-6">
                      <button
                        type="button"
                        onClick={() => removeCabinType(idx)}
                        className="absolute right-4 top-4 h-8 w-8 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                      <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Cabin {idx + 1}</h4>
                      
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                          <label className="prop-label">Cabin Category Name</label>
                          <input
                            type="text"
                            required
                            value={cabin.name}
                            onChange={(e) => updateCabinType(idx, 'name', e.target.value)}
                            placeholder="e.g. Balcony Suite, Oceanview Room"
                            className="prop-input"
                          />
                        </div>

                        <div>
                          <label className="prop-label">Price (INR)</label>
                          <input
                            type="number"
                            value={cabin.price}
                            onChange={(e) => updateCabinType(idx, 'price', e.target.value)}
                            placeholder="e.g. 62000"
                            className="prop-input"
                          />
                        </div>

                        <div className="col-span-full">
                          <label className="prop-label">Short Description</label>
                          <input
                            type="text"
                            value={cabin.description}
                            onChange={(e) => updateCabinType(idx, 'description', e.target.value)}
                            placeholder="e.g. Private balcony, 2 twin beds, minibar"
                            className="prop-input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="prop-wizard-footer">
            {TABS.findIndex(t => t.id === activeTab) > 0 ? (
               <button 
                 type="button" 
                 onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.id === activeTab) - 1].id)} 
                 className="prop-btn-back"
               >
                 <ArrowLeftIcon className="h-4 w-4" /> Back
               </button>
            ) : <div />}

            {TABS.findIndex(t => t.id === activeTab) < TABS.length - 1 ? (
               <button 
                 type="button" 
                 onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.id === activeTab) + 1].id)} 
                 className="prop-btn-next"
               >
                 Next Step
               </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saveMutation.isPending || uploadingImage}
                className="prop-btn-publish"
              >
                {saveMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Cruise'}
                <CheckCircleIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
