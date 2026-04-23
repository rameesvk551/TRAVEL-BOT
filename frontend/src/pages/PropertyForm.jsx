import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '../api/propertiesApi';
import {
  ArrowLeftIcon, HomeModernIcon, MapPinIcon, CurrencyRupeeIcon,
  PhotoIcon, CheckCircleIcon, XMarkIcon, SparklesIcon, PlusIcon,
} from '@heroicons/react/24/outline';

const AMENITY_SUGGESTIONS = [
  'Wi-Fi', 'Pool', 'Spa', 'Gym', 'Restaurant', 'Bar', 'Room Service',
  'Parking', 'Airport Shuttle', 'Beach Access', 'AC', 'Laundry',
  'Kids Club', 'Pet Friendly', 'Business Center', 'Concierge',
];

export default function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '', propertyType: 'Hotel', location: '', address: '',
    description: '', pricePerNight: '', imageUrl: '', isActive: true,
  });
  const [amenities, setAmenities] = useState([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');

  const propertyQuery = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesApi.getById(id),
    enabled: isEdit,
  });
  const propertyData = propertyQuery.data?.data;

  useEffect(() => {
    if (!imageFile) { setImagePreview(form.imageUrl || ''); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, form.imageUrl]);

  useEffect(() => {
    if (!isEdit) {
      setForm({ name: '', propertyType: 'Hotel', location: '', address: '', description: '', pricePerNight: '', imageUrl: '', isActive: true });
      setAmenities([]); setImageFile(null); setImagePreview(''); setError('');
      return;
    }
    if (!propertyData) return;
    setForm({
      name: propertyData.name || '', propertyType: propertyData.propertyType || 'Hotel',
      location: propertyData.location || '', address: propertyData.address || '',
      description: propertyData.description || '',
      pricePerNight: propertyData.pricePerNight ? String(propertyData.pricePerNight / 100) : '',
      imageUrl: propertyData.imageUrl || '', isActive: propertyData.isActive,
    });
    setAmenities(propertyData.amenities || []);
    setImageFile(null); setImagePreview(propertyData.imageUrl || ''); setError('');
  }, [isEdit, propertyData]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? propertiesApi.update(id, data) : propertiesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); navigate('/properties'); },
    onError: (err) => setError(err.response?.data?.error || 'Failed to save property'),
  });

  const uploadImage = async (file) => {
    const res = await propertiesApi.uploadImage(file);
    return res?.data?.url;
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
      const parsedPrice = form.pricePerNight === ''
        ? null
        : Number.parseInt(form.pricePerNight, 10) * 100;
      await saveMutation.mutateAsync({
        name: form.name, propertyType: form.propertyType, location: form.location,
        address: form.address, description: form.description, amenities,
        pricePerNight: Number.isNaN(parsedPrice) ? null : parsedPrice,
        imageUrl, isActive: form.isActive,
      });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally { setUploadingImage(false); }
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const addAmenity = (a) => { const t = a.trim(); if (t && !amenities.includes(t)) setAmenities([...amenities, t]); setNewAmenity(''); };
  const removeAmenity = (a) => setAmenities(amenities.filter((x) => x !== a));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); e.target.value = ''; return; }
    setError(''); setImageFile(file); setForm((c) => ({ ...c, imageUrl: '' }));
  };
  const clearImage = () => { setImageFile(null); setImagePreview(''); setForm((c) => ({ ...c, imageUrl: '' })); };

  if (isEdit && propertyQuery.isLoading) {
    return (
      <div className="w-full p-6 animate-pulse">
        <div className="mb-8 flex items-center gap-4"><div className="h-8 w-32 rounded bg-neutral-200" /><div className="h-10 w-64 rounded bg-neutral-200" /></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6"><div className="h-64 rounded-xl bg-neutral-100" /><div className="h-96 rounded-xl bg-neutral-100" /></div>
          <div className="lg:col-span-4 space-y-6"><div className="h-64 rounded-xl bg-neutral-100" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Sticky Header */}
      <div className="sticky top-[-1px] z-10 -mx-6 mb-8 border-b border-neutral-200 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/properties')} className="shell-button-ghost p-1.5"><ArrowLeftIcon className="h-5 w-5" /></button>
            <div>
              <div className="flex items-center gap-2">
                <p className="eyebrow">Property Management</p>
                <span className="h-1 w-1 rounded-full bg-neutral-300" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{isEdit ? 'Editing' : 'Draft'}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">{isEdit ? `Edit: ${form.name || 'Property'}` : 'Add New Property'}</h1>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/properties')} className="shell-button-secondary border-none bg-neutral-100 hover:bg-neutral-200">Cancel</button>
            <button onClick={handleSubmit} disabled={saveMutation.isPending || uploadingImage} className="shell-button-primary shadow-lg shadow-indigo-100">
              {uploadingImage ? 'Uploading...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Property' : 'Publish Property'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <XMarkIcon className="h-5 w-5 flex-shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main */}
        <div className="lg:col-span-8 space-y-6">
          {/* General Info */}
          <div className="shell-panel p-6">
            <div className="mb-6 flex items-center gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><SparklesIcon className="h-5 w-5" /></div>
              <div><h3 className="font-semibold text-neutral-900">General Information</h3><p className="text-xs text-neutral-500">Core details about this property.</p></div>
            </div>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-neutral-700">Property Name *</label>
                <div className="relative">
                  <input value={form.name} onChange={(e) => update('name', e.target.value)} className="shell-input-rect pl-10" placeholder="e.g. Sunset Beach Resort & Spa" required />
                  <HomeModernIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-neutral-700">Type *</label>
                  <select value={form.propertyType} onChange={(e) => update('propertyType', e.target.value)} className="shell-input-rect w-full" required>
                    <option value="Hotel">Hotel</option><option value="Resort">Resort</option><option value="Villa">Villa</option><option value="Apartment">Apartment</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-neutral-700">Location</label>
                  <div className="relative">
                    <input value={form.location} onChange={(e) => update('location', e.target.value)} className="shell-input-rect pl-10" placeholder="e.g. Bali, Indonesia" />
                    <MapPinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-neutral-700">Price / Night (₹)</label>
                  <div className="relative">
                    <input value={form.pricePerNight} onChange={(e) => update('pricePerNight', e.target.value)} className="shell-input-rect pl-10" placeholder="5000" type="number" />
                    <CurrencyRupeeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-neutral-700">Address</label>
                <textarea value={form.address} onChange={(e) => update('address', e.target.value)} className="shell-input-rect text-[13px] leading-relaxed" rows={2} placeholder="Full street address..." />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-neutral-700">Description</label>
                <textarea value={form.description} onChange={(e) => update('description', e.target.value)} className="shell-input-rect text-[13px] leading-relaxed" rows={4} placeholder="Describe the property experience for your customers..." />
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="shell-panel p-6">
            <div className="mb-6 flex items-center gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCircleIcon className="h-5 w-5" /></div>
              <div><h3 className="font-semibold text-neutral-900">Amenities & Features</h3><p className="text-xs text-neutral-500">Highlight what makes this property special.</p></div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {amenities.map((a) => (
                <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-100 transition hover:bg-emerald-100">
                  {a}
                  <button type="button" onClick={() => removeAmenity(a)} className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200 transition"><XMarkIcon className="h-3 w-3" /></button>
                </span>
              ))}
              {amenities.length === 0 && <p className="text-xs text-neutral-400 italic">No amenities added yet.</p>}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newAmenity} onChange={(e) => setNewAmenity(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(newAmenity); }}} className="shell-input-rect flex-1" placeholder="Add custom amenity..." />
              <button type="button" onClick={() => addAmenity(newAmenity)} className="shell-button-secondary px-3"><PlusIcon className="h-4 w-4" /></button>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400 mb-2">Quick Add</p>
              <div className="flex flex-wrap gap-1.5">
                {AMENITY_SUGGESTIONS.filter((s) => !amenities.includes(s)).slice(0, 12).map((s) => (
                  <button key={s} type="button" onClick={() => addAmenity(s)} className="rounded-full border border-dashed border-neutral-200 px-3 py-1 text-[11px] font-medium text-neutral-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Image Upload */}
          <div className="shell-panel p-6">
            <div className="mb-4 border-b border-neutral-100 pb-4">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2"><PhotoIcon className="h-4 w-4 text-neutral-400" />Property Cover</h3>
              <p className="text-[11px] text-neutral-500 mt-1">Showcase this property visually.</p>
            </div>
            <div className="space-y-4">
              <div className={`relative group overflow-hidden rounded-xl border-2 border-dashed transition-all ${imagePreview ? 'border-indigo-100 aspect-video' : 'border-neutral-200 aspect-[4/3]'}`}>
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={clearImage} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"><XMarkIcon className="h-6 w-6" /></button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center text-neutral-400">
                    <PhotoIcon className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-xs font-medium">Click to upload</p>
                    <p className="text-[10px] mt-1 opacity-60">High-res landscape images work best.</p>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="shell-panel p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Visibility</h3>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`relative h-6 w-11 rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-neutral-300'}`} onClick={() => update('isActive', !form.isActive)}>
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.isActive ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{form.isActive ? 'Active' : 'Inactive'}</p>
                <p className="text-[11px] text-neutral-400">{form.isActive ? 'Visible to customers' : 'Hidden from listings'}</p>
              </div>
            </label>
          </div>

          {/* Quality Checklist */}
          <div className="shell-panel p-6 bg-neutral-900 text-white border-none shadow-xl shadow-neutral-200/50">
            <h3 className="font-bold flex items-center gap-2 mb-4"><CheckCircleIcon className="h-4 w-4 text-indigo-400" />Quality Checklist</h3>
            <ul className="space-y-3">
              {[
                { label: 'Property name set', checked: !!form.name },
                { label: 'Location defined', checked: !!form.location },
                { label: 'Price configured', checked: !!form.pricePerNight },
                { label: 'Cover image added', checked: !!imagePreview },
                { label: 'Min. 3 amenities', checked: amenities.length >= 3 },
                { label: 'Description written', checked: form.description.length > 20 },
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2.5 text-xs text-neutral-300">
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${item.checked ? 'bg-indigo-500 border-indigo-500' : 'border-neutral-700'}`}>
                    {item.checked && <CheckCircleIcon className="h-3 w-3 text-white" />}
                  </div>
                  <span className={item.checked ? 'text-white' : ''}>{item.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Completion</span>
                <span className="font-bold text-indigo-400">
                  {[!!form.name, !!form.location, !!form.pricePerNight, !!imagePreview, amenities.length >= 3, form.description.length > 20].filter(Boolean).length}/6
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${([!!form.name, !!form.location, !!form.pricePerNight, !!imagePreview, amenities.length >= 3, form.description.length > 20].filter(Boolean).length / 6) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
