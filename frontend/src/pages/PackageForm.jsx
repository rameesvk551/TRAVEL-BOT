// FILE: /frontend/src/pages/PackageForm.jsx

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { packagesApi } from '../api/packagesApi';
import { useAuthStore } from '../store/authStore';
import {
  ClockIcon, CurrencyRupeeIcon, MapPinIcon,
  PhotoIcon, CheckCircleIcon, XMarkIcon, DocumentArrowUpIcon,
  ChevronRightIcon, ChevronLeftIcon,
} from '@heroicons/react/24/outline';

const STEPS = [
  { id: 1, label: 'Basics' },
  { id: 2, label: 'Inclusions' },
  { id: 3, label: 'Exclusions' },
  { id: 4, label: 'Cover' },
];

const IMAGE_EXTENSIONS = /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i;
const IMAGE_ACCEPT = 'image/*,.avif,.gif,.heic,.heif,.jpg,.jpeg,.png,.webp';
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const MAX_PDF_SIZE = 50 * 1024 * 1024;
const isImageFile = (file) => file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name || '');
const isPdfFile = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
const DEFAULT_PACKAGE_CATEGORIES = ['DOMESTIC', 'INTERNATIONAL'];

const normalizeCategory = (value) => {
  const text = String(value || '').trim();
  const normalized = text.toUpperCase();
  if (normalized === 'DOMESTIC' || normalized === 'INTERNATIONAL') return normalized;
  return text;
};

const formatCategoryLabel = (value) => {
  const text = String(value || '').trim();
  const normalized = text.toUpperCase();
  if (normalized === 'DOMESTIC') return 'Domestic';
  if (normalized === 'INTERNATIONAL') return 'International';
  return text || 'Domestic';
};

export default function PackageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;
  const agency = useAuthStore((s) => s.agency);
  const normalizedAgencyName = String(agency?.name || '').trim().toUpperCase();
  const normalizedIndustry = String(agency?.industry || '').trim().toUpperCase();
  const hideAyurvedicTravelFields = normalizedAgencyName.includes('AYURVED') || normalizedIndustry === 'AYURVEDIC';

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', category: 'DOMESTIC', tourType: '', duration: '', destinations: '', basePrice: '',
    summary: '', inclusions: '', exclusions: '', imageUrl: '', brochureUrl: '', brochureFileName: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [brochureFile, setBrochureFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState('');

  const packageQuery = useQuery({
    queryKey: ['package', id],
    queryFn: () => packagesApi.getById(id),
    enabled: isEdit,
  });
  const packageData = packageQuery.data?.data;
  const packagesQuery = useQuery({
    queryKey: ['packages', 'tour-types'],
    queryFn: () => packagesApi.list(),
  });
  const existingTourTypes = Array.from(new Set(
    (packagesQuery.data?.data || [])
      .map((pkg) => String(pkg.tourType || '').trim())
      .filter(Boolean)
      .map((type) => type.toUpperCase())
  )).sort((a, b) => a.localeCompare(b));
  const existingCategories = Array.from(new Set([
    ...DEFAULT_PACKAGE_CATEGORIES,
    ...(packagesQuery.data?.data || [])
      .map((pkg) => normalizeCategory(pkg.category))
      .filter(Boolean),
  ])).sort((a, b) => {
    const defaultA = DEFAULT_PACKAGE_CATEGORIES.indexOf(a);
    const defaultB = DEFAULT_PACKAGE_CATEGORIES.indexOf(b);
    if (defaultA !== -1 || defaultB !== -1) {
      if (defaultA === -1) return 1;
      if (defaultB === -1) return -1;
      return defaultA - defaultB;
    }
    return a.localeCompare(b);
  });

  useEffect(() => {
    if (!imageFile) { setImagePreview(form.imageUrl || ''); return undefined; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, form.imageUrl]);

  useEffect(() => {
    if (!isEdit) {
      setForm({ name: '', category: 'DOMESTIC', tourType: '', duration: '', destinations: '', basePrice: '', summary: '', inclusions: '', exclusions: '', imageUrl: '', brochureUrl: '', brochureFileName: '' });
      setImageFile(null); setBrochureFile(null); setImagePreview(''); setError('');
      return;
    }
    if (!packageData) return;
    setForm({
      name: packageData.name || '',
      category: packageData.category || 'DOMESTIC',
      tourType: packageData.tourType || '',
      duration: packageData.duration || '',
      destinations: packageData.destinations?.join(', ') || '',
      basePrice: packageData.basePrice ? String(packageData.basePrice / 100) : '',
      summary: packageData.summary || '',
      inclusions: packageData.inclusions?.join('\n') || '',
      exclusions: packageData.exclusions?.join('\n') || '',
      imageUrl: packageData.imageUrl || '',
      brochureUrl: packageData.brochureUrl || '',
      brochureFileName: packageData.brochureFileName || '',
    });
    setImageFile(null); setBrochureFile(null); setImagePreview(packageData.imageUrl || ''); setError('');
  }, [isEdit, packageData]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? packagesApi.update(id, data) : packagesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages'] }); navigate('/packages'); },
    onError: (err) => setError(err.response?.data?.error || 'Failed to save package'),
  });

  const uploadImage = async (file) => {
    const res = await packagesApi.uploadImage(file);
    return res?.data?.url;
  };

  const uploadBrochure = async (file) => {
    const res = await packagesApi.uploadBrochure(file);
    return res?.data;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    try {
      setUploadingMedia(true);
      let imageUrl = form.imageUrl || null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) throw new Error('Image upload failed');
      }

      let brochureUrl = form.brochureUrl || null;
      let brochureFileName = form.brochureFileName || null;
      if (brochureFile) {
        const uploadedBrochure = await uploadBrochure(brochureFile);
        brochureUrl = uploadedBrochure?.url;
        brochureFileName = uploadedBrochure?.fileName || brochureFile.name;
        if (!brochureUrl) throw new Error('PDF upload failed');
      }

      await saveMutation.mutateAsync({
        name: form.name,
        category: normalizeCategory(form.category) || 'DOMESTIC',
        tourType: form.tourType.trim() ? form.tourType.trim().toUpperCase() : null,
        duration: form.duration,
        destinations: form.destinations.split(',').map((d) => d.trim()).filter(Boolean),
        basePrice: form.basePrice === '' ? null : Number.parseInt(form.basePrice, 10) * 100,
        summary: form.summary.trim() || null,
        inclusions: form.inclusions.split('\n').filter(Boolean),
        exclusions: form.exclusions.split('\n').filter(Boolean),
        imageUrl,
        brochureUrl,
        brochureFileName,
      });
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save');
    } finally { setUploadingMedia(false); }
  };

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) { setError('Please choose an image file.'); e.target.value = ''; return; }
    if (file.size > MAX_IMAGE_SIZE) { setError('Image must be 25 MB or smaller.'); e.target.value = ''; return; }
    setError(''); setImageFile(file); setForm((c) => ({ ...c, imageUrl: '' }));
  };
  const clearImage = () => { setImageFile(null); setImagePreview(''); setForm((c) => ({ ...c, imageUrl: '' })); };

  const handleBrochureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isPdfFile(file)) { setError('Please choose a PDF file.'); e.target.value = ''; return; }
    if (file.size > MAX_PDF_SIZE) { setError('PDF must be 50 MB or smaller.'); e.target.value = ''; return; }
    setError('');
    setBrochureFile(file);
    setForm((c) => ({ ...c, brochureUrl: '', brochureFileName: file.name }));
  };
  const clearBrochure = () => {
    setBrochureFile(null);
    setForm((c) => ({ ...c, brochureUrl: '', brochureFileName: '' }));
  };

  const addDescriptionStar = () => {
    setForm((current) => {
      const existing = current.summary || '';
      const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
      return { ...current, summary: `${existing}${prefix}* ` };
    });
  };

  const progress = (step / STEPS.length) * 100;

  if (isEdit && packageQuery.isLoading) {
    return (
      <div className="w-full p-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-neutral-200 mb-6" />
        <div className="space-y-4">
          <div className="h-12 rounded-xl bg-neutral-100" />
          <div className="h-12 rounded-xl bg-neutral-100" />
          <div className="h-12 rounded-xl bg-neutral-100" />
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
          onClick={() => navigate('/packages')}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition mb-6 w-fit"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="text-sm font-bold">Back to Packages</span>
        </button>

        <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-2 tracking-tight">
          {isEdit ? 'Edit Package' : 'New Package'}
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          Build your tour package details below.
        </p>

        <div className="space-y-6 hidden md:block">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-4">
              <div
                className={`flex flex-shrink-0 items-center justify-center h-8 w-8 rounded-full text-sm font-bold border-2 transition-all duration-300 ${
                  step === s.id
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-md scale-110'
                    : step > s.id
                    ? 'border-neutral-900 bg-white text-neutral-900'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-400'
                }`}
              >
                {step > s.id ? <CheckCircleIcon className="h-5 w-5" /> : s.id}
              </div>
              <span
                className={`text-sm font-bold transition-colors ${
                  step >= s.id ? 'text-neutral-900' : 'text-neutral-400'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="prop-wizard-body relative">
        <div className="max-w-3xl mx-auto">
          {/* ── Error ── */}
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 shadow-sm">
              <XMarkIcon className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* STEP 1: Basics */}
          {step === 1 && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">Basic Information</h2>
              <div className="prop-wizard-fields">
                <div>
                  <label className="prop-label">Package Title <span className="text-red-400">*</span></label>
                  <input value={form.name} onChange={(e) => set('name', e.target.value)} className="prop-input" placeholder="e.g. Maldives Water Villa Escape" required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="prop-label">Category <span className="text-red-400">*</span></label>
                    <input
                      value={form.category}
                      onChange={(e) => set('category', e.target.value)}
                      onBlur={(e) => set('category', normalizeCategory(e.target.value) || 'DOMESTIC')}
                      className="prop-input"
                      list="package-category-options"
                      maxLength={100}
                      placeholder="e.g. Domestic, Ayurveda, Therapy"
                      required
                    />
                    <datalist id="package-category-options">
                      {existingCategories.map((category) => (
                        <option key={category} value={category} label={formatCategoryLabel(category)} />
                      ))}
                    </datalist>
                    <p className="mt-2 text-[11px] font-medium text-neutral-400">Choose an existing category or type a new one.</p>
                  </div>
                  <div>
                    <label className="prop-label">Base Price (₹)</label>
                    <div className="relative">
                      <input value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} className="prop-input pl-12" placeholder="Optional" type="number" />
                      <CurrencyRupeeIcon className="prop-input-icon h-5 w-5" />
                    </div>
                  </div>
                </div>

                {!hideAyurvedicTravelFields ? (
                  <>
                    <div>
                      <label className="prop-label">Tour Type</label>
                      <input
                        value={form.tourType}
                        onChange={(e) => set('tourType', e.target.value)}
                        onBlur={(e) => set('tourType', e.target.value.trim().toUpperCase())}
                        className="prop-input"
                        placeholder="e.g. COUPLE, FAMILY, COLLEGE, BUDGET"
                        list="package-tour-type-options"
                        maxLength={80}
                      />
                      <datalist id="package-tour-type-options">
                        {existingTourTypes.map((type) => (
                          <option key={type} value={type} />
                        ))}
                      </datalist>
                      {existingTourTypes.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {existingTourTypes.slice(0, 8).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => set('tourType', type)}
                              className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                                form.tourType.toUpperCase() === type
                                  ? 'border-neutral-900 bg-neutral-900 text-white'
                                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-[11px] font-medium text-neutral-400">Choose an existing type or type a new one.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                      <div>
                        <label className="prop-label">Duration</label>
                        <div className="relative">
                          <input value={form.duration} onChange={(e) => set('duration', e.target.value)} className="prop-input pl-12" placeholder="e.g. 3 Nights 4 Days" />
                          <ClockIcon className="prop-input-icon h-5 w-5" />
                        </div>
                      </div>
                      <div>
                        <label className="prop-label">Destinations</label>
                        <div className="relative">
                          <input value={form.destinations} onChange={(e) => set('destinations', e.target.value)} className="prop-input pl-12" placeholder="Male, Maafushi (comma separated)" />
                          <MapPinIcon className="prop-input-icon h-5 w-5" />
                        </div>
                      </div>
                    </div>

                  </>
                ) : null}

                <div>
                  <label className="prop-label flex items-center justify-between">
                    <span>WhatsApp Description</span>
                    <button type="button" onClick={addDescriptionStar} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 transition bg-white shadow-sm active:scale-95">
                      * Star
                    </button>
                  </label>
                  <textarea
                    value={form.summary}
                    onChange={(e) => set('summary', e.target.value)}
                    className="prop-input resize-none py-4"
                    rows={3}
                    maxLength={2000}
                    placeholder={"* Beach resort stay\n* Daily breakfast\n* Airport transfers"}
                  />
                  <p className="mt-2 text-[11px] font-medium text-neutral-400">This appears in WhatsApp package details. Asterisks (*) format as bold on WhatsApp.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Inclusions */}
          {step === 2 && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">What's Included</h2>
              <div className="prop-wizard-fields">
                <div>
                  <label className="prop-label flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2 text-neutral-900">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-500" /> Inclusions List
                    </span>
                    <span className="text-[12px] text-neutral-400 font-mono tracking-normal bg-neutral-100 px-2 py-1 rounded-md">
                      {form.inclusions.split('\n').filter(Boolean).length} items
                    </span>
                  </label>
                  <textarea
                    value={form.inclusions}
                    onChange={(e) => set('inclusions', e.target.value)}
                    className="prop-input resize-none py-4 leading-relaxed"
                    rows={6}
                    placeholder={"4-Star Accommodation\nDaily Breakfast & Dinner\nSpeedboat Transfers\nProfessional Guide"}
                  />
                  <p className="mt-2 text-xs font-medium text-neutral-400">Enter one inclusion per line. It will be formatted neatly for the customer.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Exclusions */}
          {step === 3 && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">What's Not Included</h2>
              <div className="prop-wizard-fields">
                <div>
                  <label className="prop-label flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2 text-neutral-900">
                      <XMarkIcon className="h-5 w-5 text-red-500" /> Exclusions List
                    </span>
                    <span className="text-[12px] text-neutral-400 font-mono tracking-normal bg-neutral-100 px-2 py-1 rounded-md">
                      {form.exclusions.split('\n').filter(Boolean).length} items
                    </span>
                  </label>
                  <textarea
                    value={form.exclusions}
                    onChange={(e) => set('exclusions', e.target.value)}
                    className="prop-input resize-none py-4 leading-relaxed"
                    rows={6}
                    placeholder={"Airfare\nVisa Fees\nPersonal Expenses\nOptional Tours"}
                  />
                  <p className="mt-2 text-xs font-medium text-neutral-400">Enter one exclusion per line.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Cover Image & Brochure */}
          {step === 4 && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">Media & Cover</h2>
              <div className="prop-wizard-fields">
                {/* Image upload */}
                <div className={`relative group overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
                  imagePreview
                    ? 'border-neutral-300 bg-neutral-50/30'
                    : 'border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100'
                }`}>
                  {imagePreview ? (
                    <div className="relative aspect-[16/9] md:aspect-[21/9]">
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      {imageFile?.name ? (
                        <div className="absolute bottom-4 left-4 max-w-[75%] rounded-xl bg-black/70 px-4 py-2 text-xs font-bold text-white backdrop-blur-md truncate shadow-lg">
                          {imageFile.name}
                        </div>
                      ) : null}
                      <button type="button" onClick={clearImage} className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition active:scale-95 shadow-lg">
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                      <input type="file" accept={IMAGE_ACCEPT} onChange={handleImageChange} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-neutral-400 relative cursor-pointer">
                      <div className="h-16 w-16 rounded-full bg-white shadow-sm border border-neutral-200 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                        <PhotoIcon className="h-8 w-8 text-neutral-500" />
                      </div>
                      <p className="text-sm font-bold text-neutral-700">Click or drag to upload cover photo</p>
                      <p className="text-xs mt-2 text-neutral-400 font-medium">JPEG, PNG or WEBP (Max 25MB)</p>
                      <input type="file" accept={IMAGE_ACCEPT} onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <label className="prop-label flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2 text-neutral-900">
                      <DocumentArrowUpIcon className="h-5 w-5 text-neutral-500" /> Itinerary PDF
                    </span>
                    {(brochureFile || form.brochureUrl) ? (
                      <button type="button" onClick={clearBrochure} className="text-xs font-bold text-red-500 hover:text-red-700 transition">
                        Remove File
                      </button>
                    ) : null}
                  </label>
                  <div className="relative rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-6 py-8 text-center hover:border-neutral-400 transition cursor-pointer">
                    <DocumentArrowUpIcon className="mx-auto h-10 w-10 text-neutral-400 mb-3" />
                    <p className="text-sm font-bold text-neutral-800">
                      {brochureFile?.name || form.brochureFileName || 'Upload package itinerary PDF'}
                    </p>
                    <p className="mt-2 text-xs text-neutral-500 font-medium">
                      Customers will receive this PDF via WhatsApp when they request the itinerary.
                    </p>
                    <input type="file" accept="application/pdf,.pdf" onChange={handleBrochureChange} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                  </div>
                  {form.brochureUrl && !brochureFile ? (
                    <a href={form.brochureUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                      <DocumentArrowUpIcon className="h-4 w-4" /> View current PDF
                    </a>
                  ) : null}
                </div>

                {/* Summary */}
                <div className="rounded-3xl bg-neutral-900 p-8 text-white shadow-xl">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-6">Package Summary</h4>
                  <div className="space-y-4 text-sm font-medium">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
                      <span className="text-neutral-400">Title</span>
                      <span className="font-bold truncate ml-4 max-w-[60%] text-right text-base">{form.name || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
                      <span className="text-neutral-400">Category</span>
                      <span className="font-bold">{formatCategoryLabel(form.category)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
                      <span className="text-neutral-400">Tour Type</span>
                      <span className="font-bold">{form.tourType || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
                      <span className="text-neutral-400">Price</span>
                      <span className="font-bold">{form.basePrice ? `₹${Number(form.basePrice).toLocaleString()}` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
                      <span className="text-neutral-400">Duration</span>
                      <span className="font-bold">{form.duration || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
                      <span className="text-neutral-400">Inclusions</span>
                      <span className="font-bold text-emerald-400">{form.inclusions.split('\n').filter(Boolean).length} items</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-neutral-400">Brochure PDF</span>
                      <span className="font-bold truncate ml-4 max-w-[60%] text-right">{brochureFile?.name || form.brochureFileName || 'Not uploaded'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Bottom navigation ── */}
          <div className="prop-wizard-footer">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(s => s - 1)} className="prop-btn-back">
                <ChevronLeftIcon className="h-5 w-5" /> Back
              </button>
            ) : (
              <div />
            )}

            {step < STEPS.length ? (
              <button type="button" onClick={() => setStep(s => s + 1)} className="prop-btn-next">
                Next Step <ChevronRightIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saveMutation.isPending || uploadingMedia}
                className="prop-btn-publish"
              >
                {uploadingMedia ? 'Uploading Media...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Package' : 'Publish Package'}
                {!uploadingMedia && !saveMutation.isPending && <CheckCircleIcon className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
