import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '../api/propertiesApi';
import ReelLinkSection from '../components/ReelLinkSection';
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

const IMAGE_EXTENSIONS = /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i;
const IMAGE_ACCEPT = 'image/*,.avif,.gif,.heic,.heif,.jpg,.jpeg,.png,.webp';
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const isImageFile = (file) => file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name || '');

export default function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', propertyType: 'Hotel', location: '', address: '',
    description: '', pricePerNight: '', imageUrl: '', isActive: true,
    brochureUrl: '', brochureFileName: '',
  });
  const [amenities, setAmenities] = useState([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [brochureFile, setBrochureFile] = useState(null);
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
      setForm({ name: '', propertyType: 'Hotel', location: '', address: '', description: '', pricePerNight: '', imageUrl: '', isActive: true, brochureUrl: '', brochureFileName: '' });
      setAmenities([]); setImageFile(null); setImagePreview(''); setBrochureFile(null); setError('');
      return;
    }
    if (!propertyData) return;
    setForm({
      name: propertyData.name || '', propertyType: propertyData.propertyType || 'Hotel',
      location: propertyData.location || '', address: propertyData.address || '',
      description: propertyData.description || '',
      pricePerNight: propertyData.pricePerNight ? String(propertyData.pricePerNight / 100) : '',
      imageUrl: propertyData.imageUrl || '', isActive: propertyData.isActive,
      brochureUrl: propertyData.brochureUrl || '', brochureFileName: propertyData.brochureFileName || '',
    });
    setAmenities(propertyData.amenities || []);
    setImageFile(null); setImagePreview(propertyData.imageUrl || ''); setBrochureFile(null); setError('');
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
      let brochureUrl = form.brochureUrl || null;
      let brochureFileName = form.brochureFileName || null;
      if (brochureFile) {
        const res = await propertiesApi.uploadBrochure(brochureFile);
        brochureUrl = res?.data?.url || null;
        brochureFileName = res?.data?.fileName || brochureFile.name;
        if (!brochureUrl) throw new Error('Document upload failed');
      }
      const parsedPrice = form.pricePerNight === ''
        ? null
        : Number.parseInt(form.pricePerNight, 10) * 100;
      await saveMutation.mutateAsync({
        name: form.name, propertyType: form.propertyType, location: form.location,
        address: form.address, description: form.description, amenities,
        pricePerNight: Number.isNaN(parsedPrice) ? null : parsedPrice,
        imageUrl, isActive: form.isActive,
        brochureUrl, brochureFileName,
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
    if (!isImageFile(file)) { setError('Please choose an image file.'); e.target.value = ''; return; }
    if (file.size > MAX_IMAGE_SIZE) { setError('Image must be 25 MB or smaller.'); e.target.value = ''; return; }
    setError(''); setImageFile(file); setForm((c) => ({ ...c, imageUrl: '' }));
  };
  const clearImage = () => { setImageFile(null); setImagePreview(''); setForm((c) => ({ ...c, imageUrl: '' })); };

  const handleBrochureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('Please choose a PDF file.'); e.target.value = ''; return; }
    if (file.size > 50 * 1024 * 1024) { setError('PDF must be 50 MB or smaller.'); e.target.value = ''; return; }
    setError(''); setBrochureFile(file); setForm((c) => ({ ...c, brochureUrl: '', brochureFileName: file.name }));
  };
  const clearBrochure = () => { setBrochureFile(null); setForm((c) => ({ ...c, brochureUrl: '', brochureFileName: '' })); };

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
      {/* ── Sidebar Navigation ── */}
      <div className="prop-wizard-sidebar">
        <button
          type="button"
          onClick={() => navigate('/properties')}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition mb-6 w-fit"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="text-sm font-bold">Back to Properties</span>
        </button>

        <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-2 tracking-tight">
          {isEdit ? 'Edit Property' : 'New Property'}
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          Fill in the details below to create your property listing.
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
                  <label className="prop-label">Property Name <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input value={form.name} onChange={(e) => set('name', e.target.value)} className="prop-input pl-12" placeholder="e.g. Sunset Beach Resort" required />
                    <HomeModernIcon className="prop-input-icon h-5 w-5" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  <div>
                    <label className="prop-label">Type <span className="text-red-400">*</span></label>
                    <input
                      list="property-type-options"
                      value={form.propertyType}
                      onChange={(e) => set('propertyType', e.target.value)}
                      className="prop-input"
                      placeholder="e.g. Hotel, Villa, Homestay"
                      maxLength={50}
                      required
                    />
                    <datalist id="property-type-options">
                      <option value="Hotel" />
                      <option value="Resort" />
                      <option value="Villa" />
                      <option value="Apartment" />
                      <option value="Homestay" />
                      <option value="Boutique Stay" />
                      <option value="Houseboat" />
                    </datalist>
                  </div>
                  <div>
                    <label className="prop-label">Price / Night (₹)</label>
                    <div className="relative">
                      <input value={form.pricePerNight} onChange={(e) => set('pricePerNight', e.target.value)} className="prop-input pl-12" placeholder="5000" type="number" />
                      <CurrencyRupeeIcon className="prop-input-icon h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="prop-label">Location</label>
                  <div className="relative">
                    <input value={form.location} onChange={(e) => set('location', e.target.value)} className="prop-input pl-12" placeholder="e.g. Bali, Indonesia" />
                    <MapPinIcon className="prop-input-icon h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Details */}
          {step === 2 && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">Property Details</h2>
              <div className="prop-wizard-fields">
                <div>
                  <label className="prop-label">Full Address</label>
                  <textarea value={form.address} onChange={(e) => set('address', e.target.value)} className="prop-input resize-none py-4" rows={2} placeholder="Full street address, zip code..." />
                </div>
                <div>
                  <label className="prop-label flex items-center justify-between">
                    <span>Description</span>
                    <span className="text-[11px] text-neutral-400 font-mono tracking-normal">{form.description.length} chars</span>
                  </label>
                  <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="prop-input resize-none py-4" rows={4} placeholder="Describe the property experience..." />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Amenities */}
          {step === 3 && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">Amenities</h2>
              <div className="prop-wizard-fields">
                {/* Quick-add chips */}
                <div className="flex flex-wrap gap-2.5">
                  {AMENITY_SUGGESTIONS.map((s) => {
                    const active = amenities.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => active ? removeAmenity(s) : addAmenity(s)}
                        className={`rounded-full px-5 py-2.5 text-xs font-bold border-2 transition-all duration-200 active:scale-95 ${
                          active
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-md'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 hover:shadow-sm'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}{s}
                      </button>
                    );
                  })}
                </div>

                <div className="h-px bg-neutral-200 w-full my-4" />

                {/* Custom amenity */}
                <div>
                  <label className="prop-label">Custom Amenity</label>
                  <div className="flex gap-3">
                    <input
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenity(newAmenity); }}}
                      className="prop-input flex-1"
                      placeholder="e.g. Private Chef..."
                    />
                    <button type="button" onClick={() => addAmenity(newAmenity)} className="prop-icon-btn bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800 hover:text-white">
                      <PlusIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Count */}
                <p className="text-xs font-bold text-neutral-400">
                  {amenities.length} amenities selected
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Media & Publish */}
          {step === 4 && (
            <div className="prop-wizard-step">
              <h2 className="text-2xl font-bold text-neutral-900 mb-5">Media & Visibility</h2>
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
                      <p className="text-sm font-bold text-neutral-700">Click or drag to upload photo</p>
                      <p className="text-xs mt-2 text-neutral-400 font-medium">JPEG, PNG or WEBP (Max 25MB)</p>
                      <input type="file" accept={IMAGE_ACCEPT} onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  )}
                </div>

                {/* Document (PDF) upload — sent by flows via the "Property document" source */}
                <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <p className="text-base font-bold text-neutral-900">Property document (PDF)</p>
                  <p className="text-sm text-neutral-500 mt-1 mb-4">Optional brochure/details PDF a WhatsApp flow can send on request.</p>
                  {(brochureFile?.name || form.brochureFileName || form.brochureUrl) ? (
                    <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <span className="truncate text-sm font-semibold text-neutral-700">{brochureFile?.name || form.brochureFileName || 'Document.pdf'}</span>
                      <button type="button" onClick={clearBrochure} className="ml-3 rounded-full p-1.5 text-neutral-400 hover:text-rose-500">
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 py-8 text-neutral-400 hover:border-neutral-400">
                      <p className="text-sm font-bold text-neutral-700">Click to upload PDF</p>
                      <p className="mt-1 text-xs text-neutral-400 font-medium">PDF (Max 50MB)</p>
                      <input type="file" accept="application/pdf,.pdf" onChange={handleBrochureChange} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                  )}
                </div>

                {/* Visibility toggle */}
                <div className="mt-6 flex items-center justify-between rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-base font-bold text-neutral-900">{form.isActive ? 'Active & Visible' : 'Saved as Draft'}</p>
                    <p className="text-sm text-neutral-500 mt-1">{form.isActive ? 'This property will be visible to your customers.' : 'Hidden from your public listings.'}</p>
                  </div>
                  <div
                    className={`relative h-8 w-14 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.isActive ? 'bg-neutral-900' : 'bg-neutral-300'}`}
                    onClick={() => set('isActive', !form.isActive)}
                  >
                    <div className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.isActive ? 'translate-x-[26px]' : 'translate-x-1'}`} />
                  </div>
                </div>

                {/* Link Instagram reels that advertise this property */}
                <div className="mt-6">
                  <ReelLinkSection itemType="PROPERTY" itemId={id} />
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
                disabled={saveMutation.isPending || uploadingImage}
                className="prop-btn-publish"
              >
                {uploadingImage ? 'Uploading...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Property' : 'Publish Property'}
                {!uploadingImage && !saveMutation.isPending && <CheckCircleIcon className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
