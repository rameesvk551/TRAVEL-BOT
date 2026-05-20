// FILE: /frontend/src/pages/PackageForm.jsx

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { packagesApi } from '../api/packagesApi';
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

export default function PackageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

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
        category: form.category,
        tourType: form.tourType.trim() ? form.tourType.trim().toUpperCase() : null,
        duration: form.duration,
        destinations: form.destinations.split(',').map((d) => d.trim()).filter(Boolean),
        basePrice: Number.parseInt(form.basePrice, 10) * 100,
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
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); e.target.value = ''; return; }
    setError(''); setImageFile(file); setForm((c) => ({ ...c, imageUrl: '' }));
  };
  const clearImage = () => { setImageFile(null); setImagePreview(''); setForm((c) => ({ ...c, imageUrl: '' })); };

  const handleBrochureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('Please choose a PDF file.'); e.target.value = ''; return; }
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
      {/* ── Progress bar ── */}
      <div className="prop-wizard-progress-track">
        <div className="prop-wizard-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* ── Step dots ── */}
      <div className="flex items-center justify-center gap-6 py-3">
        {STEPS.map((s) => (
          <button key={s.id} type="button" onClick={() => setStep(s.id)} className="flex flex-col items-center gap-1">
            <div className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
              step > s.id ? 'bg-neutral-900 scale-100' :
              step === s.id ? 'bg-neutral-900 scale-125 ring-4 ring-neutral-200' :
              'bg-neutral-200 scale-100'
            }`} />
            <span className={`text-[10px] font-semibold transition-colors ${
              step === s.id ? 'text-neutral-900' : step > s.id ? 'text-neutral-600' : 'text-neutral-400'
            }`}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <XMarkIcon className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Step content ── */}
      <div className="prop-wizard-body">

        {/* STEP 1: Basics */}
        {step === 1 && (
          <div className="prop-wizard-step">
            <div className="prop-wizard-fields">
              <div>
                <label className="prop-label">Package Title <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className="prop-input" placeholder="e.g. Maldives Water Villa Escape" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="prop-label">Category <span className="text-red-400">*</span></label>
                  <select value={form.category} onChange={(e) => set('category', e.target.value)} className="prop-input" required>
                    <option value="DOMESTIC">Domestic</option>
                    <option value="INTERNATIONAL">International</option>
                  </select>
                </div>
                <div>
                  <label className="prop-label">Base Price (₹) <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} className="prop-input pl-9" placeholder="15000" type="number" required />
                    <CurrencyRupeeIcon className="prop-input-icon" />
                  </div>
                </div>
              </div>

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
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {existingTourTypes.slice(0, 8).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set('tourType', type)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                          form.tourType.toUpperCase() === type
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="mt-1.5 text-[10px] text-neutral-400">Choose an existing type or type a new one.</p>
              </div>

              <div>
                <label className="prop-label">Duration</label>
                <div className="relative">
                  <input value={form.duration} onChange={(e) => set('duration', e.target.value)} className="prop-input pl-9" placeholder="e.g. 3 Nights 4 Days" />
                  <ClockIcon className="prop-input-icon" />
                </div>
              </div>

              <div>
                <label className="prop-label">Destinations</label>
                <div className="relative">
                  <input value={form.destinations} onChange={(e) => set('destinations', e.target.value)} className="prop-input pl-9" placeholder="Male, Maafushi (comma separated)" />
                  <MapPinIcon className="prop-input-icon" />
                </div>
              </div>

              <div>
                <label className="prop-label flex items-center justify-between">
                  <span>WhatsApp Description</span>
                  <button type="button" onClick={addDescriptionStar} className="rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900">
                    * Star
                  </button>
                </label>
                <textarea
                  value={form.summary}
                  onChange={(e) => set('summary', e.target.value)}
                  className="prop-input resize-none"
                  rows={4}
                  maxLength={2000}
                  placeholder={"* Beach resort stay\n* Daily breakfast\n* Airport transfers"}
                />
                <p className="mt-1.5 text-[10px] text-neutral-400">This appears in WhatsApp package details. Stars are shown as stars.</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Inclusions */}
        {step === 2 && (
          <div className="prop-wizard-step">
            <div className="prop-wizard-fields">
              <div>
                <label className="prop-label flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircleIcon className="h-4 w-4 text-neutral-500" /> What's Included
                  </span>
                  <span className="text-[10px] text-neutral-300 font-mono normal-case tracking-normal">
                    {form.inclusions.split('\n').filter(Boolean).length} items
                  </span>
                </label>
                <textarea
                  value={form.inclusions}
                  onChange={(e) => set('inclusions', e.target.value)}
                  className="prop-input resize-none"
                  rows={8}
                  placeholder={"4-Star Accommodation\nDaily Breakfast & Dinner\nSpeedboat Transfers\nProfessional Guide"}
                />
                <p className="mt-1.5 text-[10px] text-neutral-400">One inclusion per line</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Exclusions */}
        {step === 3 && (
          <div className="prop-wizard-step">
            <div className="prop-wizard-fields">
              <div>
                <label className="prop-label flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <XMarkIcon className="h-4 w-4 text-red-400" /> What's Not Included
                  </span>
                  <span className="text-[10px] text-neutral-300 font-mono normal-case tracking-normal">
                    {form.exclusions.split('\n').filter(Boolean).length} items
                  </span>
                </label>
                <textarea
                  value={form.exclusions}
                  onChange={(e) => set('exclusions', e.target.value)}
                  className="prop-input resize-none"
                  rows={8}
                  placeholder={"Airfare\nVisa Fees\nPersonal Expenses\nOptional Tours"}
                />
                <p className="mt-1.5 text-[10px] text-neutral-400">One exclusion per line</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Cover Image */}
        {step === 4 && (
          <div className="prop-wizard-step">
            <div className="prop-wizard-fields">
              <div className={`relative group overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                imagePreview
                  ? 'border-neutral-300 bg-neutral-50/30'
                  : 'border-dashed border-neutral-200 bg-neutral-50 hover:border-neutral-400'
              }`}>
                {imagePreview ? (
                  <div className="relative aspect-video">
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover rounded-lg" />
                    <button type="button" onClick={clearImage} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-neutral-400 relative cursor-pointer">
                    <div className="h-14 w-14 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                      <PhotoIcon className="h-7 w-7 text-neutral-500" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-600">Tap to upload cover image</p>
                    <p className="text-[11px] mt-1 text-neutral-400">Landscape images work best</p>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <label className="prop-label flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <DocumentArrowUpIcon className="h-4 w-4 text-neutral-500" /> Itinerary PDF
                  </span>
                  {(brochureFile || form.brochureUrl) ? (
                    <button type="button" onClick={clearBrochure} className="text-[10px] font-semibold text-red-500 hover:text-red-600">
                      Remove
                    </button>
                  ) : null}
                </label>
                <div className="relative rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center hover:border-neutral-400">
                  <DocumentArrowUpIcon className="mx-auto h-7 w-7 text-neutral-500" />
                  <p className="mt-2 text-xs font-semibold text-neutral-700">
                    {brochureFile?.name || form.brochureFileName || 'Upload package itinerary PDF'}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Customers receive this PDF from Download Itinerary.
                  </p>
                  <input type="file" accept="application/pdf,.pdf" onChange={handleBrochureChange} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </div>
                {form.brochureUrl && !brochureFile ? (
                  <a href={form.brochureUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[11px] font-semibold text-emerald-700 hover:text-emerald-800">
                    View current PDF
                  </a>
                ) : null}
              </div>

              {/* Summary */}
              <div className="rounded-xl bg-neutral-900 p-4 text-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Package Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Title</span>
                    <span className="font-semibold truncate ml-4 max-w-[60%] text-right">{form.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Category</span>
                    <span className="font-semibold">{form.category === 'INTERNATIONAL' ? 'International' : 'Domestic'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Tour Type</span>
                    <span className="font-semibold">{form.tourType || 'â€”'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Price</span>
                    <span className="font-semibold">{form.basePrice ? `₹${Number(form.basePrice).toLocaleString()}` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Duration</span>
                    <span className="font-semibold">{form.duration || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Inclusions</span>
                    <span className="font-semibold">{form.inclusions.split('\n').filter(Boolean).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">PDF</span>
                    <span className="font-semibold truncate ml-4 max-w-[60%] text-right">{brochureFile?.name || form.brochureFileName || 'Not uploaded'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom navigation ── */}
      <div className="prop-wizard-footer">
        {step > 1 ? (
          <button type="button" onClick={() => setStep(s => s - 1)} className="prop-btn-back">
            <ChevronLeftIcon className="h-4 w-4" /> Back
          </button>
        ) : (
          <div />
        )}

        {step < STEPS.length ? (
          <button type="button" onClick={() => setStep(s => s + 1)} className="prop-btn-next">
            Next <ChevronRightIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saveMutation.isPending || uploadingMedia}
            className="prop-btn-publish"
          >
            {uploadingMedia ? 'Uploading...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Publish'}
            {!uploadingMedia && !saveMutation.isPending && <CheckCircleIcon className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
