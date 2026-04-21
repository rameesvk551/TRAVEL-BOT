// FILE: /frontend/src/pages/PackageForm.jsx

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { packagesApi } from '../api/packagesApi';
import { 
  ArrowLeftIcon, 
  ClockIcon, 
  CurrencyRupeeIcon, 
  MapPinIcon, 
  PhotoIcon, 
  CheckCircleIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

export default function PackageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '', category: 'DOMESTIC', duration: '', destinations: '', basePrice: '',
    inclusions: '', exclusions: '', imageUrl: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');

  const packageQuery = useQuery({
    queryKey: ['package', id],
    queryFn: () => packagesApi.getById(id),
    enabled: isEdit,
  });

  const packageData = packageQuery.data?.data;

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(form.imageUrl || '');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile, form.imageUrl]);

  useEffect(() => {
    if (!isEdit) {
      setForm({
        name: '', category: 'DOMESTIC', duration: '', destinations: '', basePrice: '',
        inclusions: '', exclusions: '', imageUrl: '',
      });
      setImageFile(null);
      setImagePreview('');
      setError('');
      return;
    }

    if (!packageData) return;

    setForm({
      name: packageData.name || '',
      category: packageData.category || 'DOMESTIC',
      duration: packageData.duration || '',
      destinations: packageData.destinations?.join(', ') || '',
      basePrice: packageData.basePrice ? String(packageData.basePrice / 100) : '',
      inclusions: packageData.inclusions?.join('\n') || '',
      exclusions: packageData.exclusions?.join('\n') || '',
      imageUrl: packageData.imageUrl || '',
    });
    setImageFile(null);
    setImagePreview(packageData.imageUrl || '');
    setError('');
  }, [isEdit, packageData]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? packagesApi.update(id, data) : packagesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      navigate('/packages');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to save package'),
  });

  const uploadImage = async (file) => {
    const response = await packagesApi.uploadImage(file);
    return response?.data?.url;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    try {
      setUploadingImage(true);
      let imageUrl = form.imageUrl || null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) throw new Error('Image upload failed');
      }

      await saveMutation.mutateAsync({
        name: form.name,
        category: form.category,
        duration: form.duration,
        destinations: form.destinations.split(',').map((d) => d.trim()).filter(Boolean),
        basePrice: Number.parseInt(form.basePrice, 10) * 100,
        inclusions: form.inclusions.split('\n').filter(Boolean),
        exclusions: form.exclusions.split('\n').filter(Boolean),
        imageUrl,
      });
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save package');
    } finally {
      setUploadingImage(false);
    }
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      event.target.value = '';
      return;
    }

    setError('');
    setImageFile(file);
    setForm((current) => ({ ...current, imageUrl: '' }));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setForm((current) => ({ ...current, imageUrl: '' }));
  };

  if (isEdit && packageQuery.isLoading) {
    return (
      <div className="w-full p-6 animate-pulse">
        <div className="mb-8 flex items-center gap-4">
          <div className="h-8 w-32 rounded bg-slate-200" />
          <div className="h-10 w-64 rounded bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="h-64 rounded-xl bg-slate-100" />
            <div className="h-96 rounded-xl bg-slate-100" />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="h-64 rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Sticky Header Actions */}
      <div className="sticky top-[-1px] z-10 -mx-6 mb-8 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/packages')} className="shell-button-ghost p-1.5">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <p className="eyebrow">Inventory Catalog</p>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {isEdit ? 'Revision Mode' : 'Draft'}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {isEdit ? `Edit: ${form.name || 'Package'}` : 'Create New Package'}
              </h1>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/packages')} className="shell-button-secondary border-none bg-slate-100 hover:bg-slate-200">
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={saveMutation.isPending || uploadingImage} 
              className="shell-button-primary shadow-indigo-100 shadow-lg"
            >
              {uploadingImage ? 'Uploading...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Package' : 'Publish Package'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 animate-slide-up">
          <XMarkIcon className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-6">
          <div className="shell-panel p-6">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <SparklesIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">General Information</h3>
                <p className="text-xs text-slate-500">Core details that define the travel package experience.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Package Title *</label>
                <div className="relative">
                  <input
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    className="shell-input-rect pl-10"
                    placeholder="e.g. Maldives Water Villa Escape with Sunset Cruise"
                    required
                  />
                  <SparklesIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => update('category', e.target.value)}
                    className="shell-input-rect w-full"
                    required
                  >
                    <option value="DOMESTIC">Domestic</option>
                    <option value="INTERNATIONAL">International</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Duration</label>
                  <div className="relative">
                    <input 
                      value={form.duration} 
                      onChange={(e) => update('duration', e.target.value)} 
                      className="shell-input-rect pl-10" 
                      placeholder="e.g. 3 Nights 4 Days" 
                    />
                    <ClockIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Base Price (₹/person) *</label>
                  <div className="relative">
                    <input 
                      value={form.basePrice} 
                      onChange={(e) => update('basePrice', e.target.value)} 
                      className="shell-input-rect pl-10" 
                      placeholder="15000" 
                      type="number" 
                      required 
                    />
                    <CurrencyRupeeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Destination Coverage</label>
                <div className="relative">
                  <input 
                    value={form.destinations} 
                    onChange={(e) => update('destinations', e.target.value)} 
                    className="shell-input-rect pl-10" 
                    placeholder="e.g. Male, Maafushi, Private Island (comma separated)" 
                  />
                  <MapPinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="shell-panel p-6 border-emerald-100">
              <div className="mb-4 flex items-center gap-2 text-emerald-700">
                <CheckCircleIcon className="h-5 w-5" />
                <h3 className="font-semibold">Inclusions</h3>
              </div>
              <textarea
                value={form.inclusions}
                onChange={(e) => update('inclusions', e.target.value)}
                className="shell-input-rect min-h-[220px] bg-emerald-50/10 border-emerald-50 focus:border-emerald-200 focus:ring-emerald-50 text-[13px] leading-relaxed"
                rows={8}
                placeholder={"• 4-Star Accomodation\n• Daily Breakfast & Dinner\n• Speedboat Transfers\n• Professional Guide"}
              />
              <p className="mt-2 text-[10px] text-slate-400 italic">Enter each inclusion on a new line.</p>
            </div>

            <div className="shell-panel p-6 border-slate-100">
              <div className="mb-4 flex items-center gap-2 text-slate-700">
                <XMarkIcon className="h-5 w-5" />
                <h3 className="font-semibold">Exclusions</h3>
              </div>
              <textarea
                value={form.exclusions}
                onChange={(e) => update('exclusions', e.target.value)}
                className="shell-input-rect min-h-[220px] bg-slate-50/30 border-slate-100 text-[13px] leading-relaxed"
                rows={8}
                placeholder={"• Airfare\n• Visa Fees\n• Personal Expenses\n• Optional Tours"}
              />
              <p className="mt-2 text-[10px] text-slate-400 italic">Enter each exclusion on a new line.</p>
            </div>
          </div>
        </div>

        {/* Sidebar / Secondary Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="shell-panel p-6">
            <div className="mb-4 border-b border-slate-100 pb-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <PhotoIcon className="h-4 w-4 text-slate-400" />
                Package Cover
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">Visually represent this package to your customers.</p>
            </div>

            <div className="space-y-4">
              <div className={`relative group overflow-hidden rounded-xl border-2 border-dashed transition-all ${imagePreview ? 'border-indigo-100 aspect-video' : 'border-slate-200 aspect-square'}`}>
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={clearImage} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40">
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-400">
                    <PhotoIcon className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-xs font-medium">Click to upload package image</p>
                    <p className="text-[10px] mt-1 opacity-60">High resolution landscape images work best.</p>
                    <input
                      type="file"
                      id="pkg-image"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
              
              {!imagePreview && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    <strong>Pro Tip:</strong> Packages with high-quality images see 40% higher engagement in chat quotes.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="shell-panel p-6 bg-slate-900 text-white border-none shadow-xl shadow-slate-200/50">
            <div className="mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-indigo-400" />
                Quality Checklist
              </h3>
            </div>
            <ul className="space-y-3">
              {[
                { label: 'Clear Package Title', checked: !!form.name },
                { label: 'Base Price Defined', checked: !!form.basePrice },
                { label: 'Cover Image Added', checked: !!imagePreview },
                { label: 'Min. 3 Inclusions', checked: form.inclusions.split('\n').filter(Boolean).length >= 1 }
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2.5 text-xs text-slate-300">
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${item.checked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'}`}>
                    {item.checked && <CheckCircleIcon className="h-3 w-3 text-white" />}
                  </div>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}
