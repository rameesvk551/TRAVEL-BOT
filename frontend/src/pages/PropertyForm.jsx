import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '../api/propertiesApi';
import {
  HomeModernIcon, MapPinIcon, CurrencyRupeeIcon,
  PhotoIcon, CheckCircleIcon, XMarkIcon, PlusIcon,
  ChevronRightIcon, ChevronLeftIcon,
} from '@heroicons/react/24/outline';

const AMENITY_SUGGESTIONS = [
  'Wi-Fi', 'Pool', 'Spa', 'Gym', 'Restaurant', 'Bar', 'Room Service',
  'Parking', 'Airport Shuttle', 'Beach Access', 'AC', 'Laundry',
  'Kids Club', 'Pet Friendly', 'Business Center', 'Concierge',
];

const STEPS = [
  { id: 1, label: 'Basics' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Amenities' },
  { id: 4, label: 'Media' },
];

export default function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [step, setStep] = useState(1);
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

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const addAmenity = (a) => { const t = a.trim(); if (t && !amenities.includes(t)) setAmenities([...amenities, t]); setNewAmenity(''); };
  const removeAmenity = (a) => setAmenities(amenities.filter((x) => x !== a));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); e.target.value = ''; return; }
    setError(''); setImageFile(file); setForm((c) => ({ ...c, imageUrl: '' }));
  };
  const clearImage = () => { setImageFile(null); setImagePreview(''); setForm((c) => ({ ...c, imageUrl: '' })); };

  const progress = (step / STEPS.length) * 100;

  if (isEdit && propertyQuery.isLoading) {
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
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className="flex flex-col items-center gap-1"
          >
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
                <label className="prop-label">Property Name <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input value={form.name} onChange={(e) => set('name', e.target.value)} className="prop-input pl-9" placeholder="e.g. Sunset Beach Resort" required />
                  <HomeModernIcon className="prop-input-icon" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="prop-label">Type <span className="text-red-400">*</span></label>
                  <select value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)} className="prop-input" required>
                    <option value="Hotel">Hotel</option>
                    <option value="Resort">Resort</option>
                    <option value="Villa">Villa</option>
                    <option value="Apartment">Apartment</option>
                  </select>
                </div>
                <div>
                  <label className="prop-label">Price / Night (₹)</label>
                  <div className="relative">
                    <input value={form.pricePerNight} onChange={(e) => set('pricePerNight', e.target.value)} className="prop-input pl-9" placeholder="5000" type="number" />
                    <CurrencyRupeeIcon className="prop-input-icon" />
                  </div>
                </div>
              </div>

              <div>
                <label className="prop-label">Location</label>
                <div className="relative">
                  <input value={form.location} onChange={(e) => set('location', e.target.value)} className="prop-input pl-9" placeholder="e.g. Bali, Indonesia" />
                  <MapPinIcon className="prop-input-icon" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Details */}
        {step === 2 && (
          <div className="prop-wizard-step">

            <div className="prop-wizard-fields">
              <div>
                <label className="prop-label">Full Address</label>
                <textarea value={form.address} onChange={(e) => set('address', e.target.value)} className="prop-input resize-none" rows={2} placeholder="Full street address, zip code..." />
              </div>
              <div>
                <label className="prop-label flex items-center justify-between">
                  <span>Description</span>
                  <span className="text-[10px] text-neutral-300 font-mono">{form.description.length}</span>
                </label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="prop-input resize-none" rows={4} placeholder="Describe the property experience..." />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Amenities */}
        {step === 3 && (
          <div className="prop-wizard-step">

            <div className="prop-wizard-fields">
              {/* Quick-add chips */}
              <div className="flex flex-wrap gap-1.5">
                {AMENITY_SUGGESTIONS.map((s) => {
                  const active = amenities.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => active ? removeAmenity(s) : addAmenity(s)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-all duration-200 ${
                        active
                          ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}{s}
                    </button>
                  );
                })}
              </div>

              {/* Custom amenity */}
              <div className="flex gap-2">
                <input
                  value={newAmenity}
                  onChange={(e) => setNewAmenity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(newAmenity); }}}
                  className="prop-input flex-1"
                  placeholder="Custom amenity..."
                />
                <button type="button" onClick={() => addAmenity(newAmenity)} className="prop-icon-btn">
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Count */}
              <p className="text-[11px] font-semibold text-neutral-400 text-center">
                {amenities.length} amenities selected
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Media & Publish */}
        {step === 4 && (
          <div className="prop-wizard-step">

            <div className="prop-wizard-fields">
              {/* Image upload */}
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
                  <div className="flex flex-col items-center justify-center py-10 text-neutral-400 relative cursor-pointer">
                    <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                      <PhotoIcon className="h-6 w-6 text-neutral-500" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-600">Tap to upload photo</p>
                    <p className="text-[10px] mt-1 text-neutral-400">Landscape images work best</p>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>
                )}
              </div>

              {/* Visibility toggle */}
              <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{form.isActive ? 'Active' : 'Draft'}</p>
                  <p className="text-[10px] text-neutral-400">{form.isActive ? 'Visible to customers' : 'Hidden from listings'}</p>
                </div>
                <div
                  className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer ${form.isActive ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  onClick={() => set('isActive', !form.isActive)}
                >
                  <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${form.isActive ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
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
            disabled={saveMutation.isPending || uploadingImage}
            className="prop-btn-publish"
          >
            {uploadingImage ? 'Uploading...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Publish'}
            {!uploadingImage && !saveMutation.isPending && <CheckCircleIcon className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
