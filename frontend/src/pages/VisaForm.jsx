// FILE: /frontend/src/pages/VisaForm.jsx

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { visasApi } from '../api/visasApi';
import {
  ArrowLeftIcon,
  PhotoIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basics', label: 'Basic Info' },
  { id: 'docs', label: 'Required Documents' },
];

const VISA_TYPES = [
  'Tourist',
  'Business',
  'Student',
  'Transit',
  'Work',
  'Medical',
];

export default function VisaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [activeTab, setActiveTab] = useState('basics');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const [form, setForm] = useState({
    country: '',
    visaType: 'Tourist',
    price: '',
    processingTime: '',
    validityPeriod: '',
    requiredDocuments: '',
    description: '',
    imageUrl: '',
    eligibilityNotes: '',
    isActive: true,
  });

  // Fetch visa in edit mode
  const { data: visaData, isLoading: loadingVisa } = useQuery({
    queryKey: ['visa', id],
    queryFn: () => visasApi.getById(id),
    enabled: isEdit,
  });

  // Load data into form
  useEffect(() => {
    if (visaData?.success && visaData?.data) {
      const visa = visaData.data;
      setForm({
        country: visa.country || '',
        visaType: visa.visaType || 'Tourist',
        price: visa.price ? (visa.price / 100).toString() : '',
        processingTime: visa.processingTime || '',
        validityPeriod: visa.validityPeriod || '',
        requiredDocuments: Array.isArray(visa.requiredDocuments) ? visa.requiredDocuments.join('\n') : '',
        description: visa.description || '',
        imageUrl: visa.imageUrl || '',
        eligibilityNotes: visa.eligibilityNotes || '',
        isActive: visa.isActive !== false,
      });
      setImagePreview(visa.imageUrl || '');
    }
  }, [visaData]);

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
      const res = await visasApi.uploadImage(file);
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

  // Submit Mutation
  const saveMutation = useMutation({
    mutationFn: (data) => (isEdit ? visasApi.update(id, data) : visasApi.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visas'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['visa', id] });
      navigate('/visas');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.country) {
      alert('Please enter a country name.');
      return;
    }

    // Prepare payload
    const payload = {
      ...form,
      price: form.price ? Math.round(parseFloat(form.price) * 100) : null,
      requiredDocuments: form.requiredDocuments
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean),
    };

    saveMutation.mutate(payload);
  };

  if (isEdit && loadingVisa) {
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
          onClick={() => navigate('/visas')}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition mb-6 w-fit"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span className="text-sm font-bold">Back to Visas</span>
        </button>

        <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-2 tracking-tight">
          {isEdit ? 'Edit Visa Service' : 'New Visa Service'}
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          Provide visa processing guidelines, pricing, and required documentation.
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
                  <label className="prop-label">Country <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.country}
                    onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="e.g. United Arab Emirates"
                    className="prop-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="prop-label">Visa Type</label>
                    <select
                      value={form.visaType}
                      onChange={(e) => setForm((prev) => ({ ...prev, visaType: e.target.value }))}
                      className="prop-input"
                    >
                      {VISA_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="prop-label">Price / Service Fee (INR)</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="e.g. 7500"
                      className="prop-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="prop-label">Processing Time</label>
                    <input
                      type="text"
                      value={form.processingTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, processingTime: e.target.value }))}
                      placeholder="e.g. 3-5 Business Days"
                      className="prop-input"
                    />
                  </div>
                  <div>
                    <label className="prop-label">Validity Period</label>
                    <input
                      type="text"
                      value={form.validityPeriod}
                      onChange={(e) => setForm((prev) => ({ ...prev, validityPeriod: e.target.value }))}
                      placeholder="e.g. 30 Days Single Entry"
                      className="prop-input"
                    />
                  </div>
                </div>

                {/* Country Image Upload */}
                <div>
                  <label className="prop-label mb-4">Service Banner or Flag</label>
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
                        <span className="text-sm font-bold text-neutral-700">Upload Banner</span>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                    )}
                  </div>
                  {uploadingImage && <p className="mt-3 text-xs font-bold text-indigo-600 animate-pulse">Uploading...</p>}
                </div>

                <div>
                  <label className="prop-label">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Provide overview of the visa service..."
                    rows={3}
                    className="prop-input resize-none py-4"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: Documents */}
          {activeTab === 'docs' && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">Required Documents & Eligibility</h2>
              <div className="prop-wizard-fields">
                <div>
                  <label className="prop-label flex items-center gap-2 mb-4">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" /> Required Documents
                  </label>
                  <textarea
                    value={form.requiredDocuments}
                    onChange={(e) => setForm((prev) => ({ ...prev, requiredDocuments: e.target.value }))}
                    placeholder="e.g. Scanned copy of first & last page of Passport&#10;White background passport size photo&#10;Confirm return air ticket"
                    rows={5}
                    className="prop-input resize-none py-4"
                  />
                  <p className="mt-2 text-xs font-medium text-neutral-400">One item per line.</p>
                </div>

                <div>
                  <label className="prop-label">Eligibility Notes</label>
                  <textarea
                    value={form.eligibilityNotes}
                    onChange={(e) => setForm((prev) => ({ ...prev, eligibilityNotes: e.target.value }))}
                    placeholder="Specify eligibility guidelines (e.g., minimum 6 months validity on passport, age limits, etc.)..."
                    rows={3}
                    className="prop-input resize-none py-4"
                  />
                </div>
              </div>
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
                {saveMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Visa'}
                <CheckCircleIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
