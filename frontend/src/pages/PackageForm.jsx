// FILE: /frontend/src/pages/PackageForm.jsx

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { packagesApi } from '../api/packagesApi';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PackageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '', duration: '', destinations: '', basePrice: '',
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
        name: '',
        duration: '',
        destinations: '',
        basePrice: '',
        inclusions: '',
        exclusions: '',
        imageUrl: '',
      });
      setImageFile(null);
      setImagePreview('');
      setError('');
      return;
    }

    if (!packageData) return;

    setForm({
      name: packageData.name || '',
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
    e.preventDefault();
    setError('');

    try {
      setUploadingImage(true);

      let imageUrl = form.imageUrl || null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);

        if (!imageUrl) {
          throw new Error('Image upload failed');
        }
      }

      await saveMutation.mutateAsync({
        name: form.name,
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
      <div className="mx-auto w-full max-w-4xl p-6">
        <button onClick={() => navigate('/packages')} className="shell-button-ghost mb-4">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Packages
        </button>

        <div className="shell-panel p-6 text-sm text-slate-500">Loading package details...</div>
      </div>
    );
  }

  if (isEdit && packageQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6">
        <button onClick={() => navigate('/packages')} className="shell-button-ghost mb-4">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Packages
        </button>

        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {packageQuery.error?.response?.data?.error || packageQuery.error?.message || 'Failed to load package details'}
        </div>

        <button type="button" onClick={() => navigate('/packages')} className="shell-button-secondary">
          Return to Packages
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <button onClick={() => navigate('/packages')} className="shell-button-ghost mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Packages
      </button>

      <div className="shell-panel p-6 md:p-8">
        <div className="mb-6">
          <p className="eyebrow mb-2">Packages</p>
          <h1 className="page-title text-[2rem] sm:text-[2.4rem]">{isEdit ? 'Edit Package' : 'New Package'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Create or update a package itinerary for quoting, chat flows, and brochure publishing.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Package Name *</label>
              <input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="shell-input-rect"
                placeholder="Munnar & Alleppey Delight"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Duration</label>
              <input value={form.duration} onChange={(e) => update('duration', e.target.value)} className="shell-input-rect" placeholder="3 Nights 4 Days" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Base Price (₹/person) *</label>
              <input value={form.basePrice} onChange={(e) => update('basePrice', e.target.value)} className="shell-input-rect" placeholder="15000" type="number" required />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Destinations (comma-separated)</label>
            <input value={form.destinations} onChange={(e) => update('destinations', e.target.value)} className="shell-input-rect" placeholder="Munnar, Alleppey, Kochi" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Inclusions (one per line)</label>
            <textarea
              value={form.inclusions}
              onChange={(e) => update('inclusions', e.target.value)}
              className="shell-input-rect min-h-[120px] rounded-[16px]"
              rows={4}
              placeholder={"Hotel accommodation\nBreakfast & dinner\nSightseeing\nTransport"}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Exclusions (one per line)</label>
            <textarea
              value={form.exclusions}
              onChange={(e) => update('exclusions', e.target.value)}
              className="shell-input-rect min-h-[96px] rounded-[16px]"
              rows={3}
              placeholder={"Airfare\nPersonal expenses\nEntry tickets"}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Package Image</label>
            <div className="space-y-4 rounded-[18px] border border-dashed border-slate-200 bg-slate-50 p-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#0d1b3e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#0b5d54]"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">
                  Upload a JPG, PNG, WebP, or AVIF file. The file is uploaded via the backend and saved as the package cover image.
                </p>
                <button type="button" onClick={clearImage} className="shell-button-ghost whitespace-nowrap">
                  Remove image
                </button>
              </div>

              {imagePreview ? (
                <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm">
                  <img src={imagePreview} alt="Package preview" className="h-56 w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-[16px] border border-slate-200 bg-white text-sm text-slate-400">
                  No image selected yet
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={() => navigate('/packages')} className="shell-button-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending || uploadingImage} className="shell-button-primary flex-1">
              {uploadingImage ? 'Uploading Image...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Package' : 'Create Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
