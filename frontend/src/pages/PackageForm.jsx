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

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(form.imageUrl || '');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile, form.imageUrl]);

  // Load existing package for edit
  useQuery({
    queryKey: ['package', id],
    queryFn: () => packagesApi.getById(id),
    enabled: isEdit,
    onSuccess: (data) => {
      const pkg = data.data;
      setForm({
        name: pkg.name,
        duration: pkg.duration || '',
        destinations: pkg.destinations?.join(', ') || '',
        basePrice: String((pkg.basePrice || 0) / 100),
        inclusions: pkg.inclusions?.join('\n') || '',
        exclusions: pkg.exclusions?.join('\n') || '',
        imageUrl: pkg.imageUrl || '',
      });
      setImageFile(null);
      setImagePreview(pkg.imageUrl || '');
    },
  });

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
        basePrice: parseInt(form.basePrice, 10) * 100,
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

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate('/packages')} className="btn-ghost text-sm mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Packages
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? 'Edit Package' : 'New Package'}</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        <div>
          <label className="block text-sm text-surface-300 mb-1.5">Package Name *</label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} className="input-field" placeholder="Munnar & Alleppey Delight" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-surface-300 mb-1.5">Duration</label>
            <input value={form.duration} onChange={(e) => update('duration', e.target.value)} className="input-field" placeholder="3 Nights 4 Days" />
          </div>
          <div>
            <label className="block text-sm text-surface-300 mb-1.5">Base Price (₹/person) *</label>
            <input value={form.basePrice} onChange={(e) => update('basePrice', e.target.value)} className="input-field" placeholder="15000" type="number" required />
          </div>
        </div>

        <div>
          <label className="block text-sm text-surface-300 mb-1.5">Destinations (comma-separated)</label>
          <input value={form.destinations} onChange={(e) => update('destinations', e.target.value)} className="input-field" placeholder="Munnar, Alleppey, Kochi" />
        </div>

        <div>
          <label className="block text-sm text-surface-300 mb-1.5">Inclusions (one per line)</label>
          <textarea value={form.inclusions} onChange={(e) => update('inclusions', e.target.value)} className="input-field" rows={4} placeholder={"Hotel accommodation\nBreakfast & dinner\nSightseeing\nTransport"} />
        </div>

        <div>
          <label className="block text-sm text-surface-300 mb-1.5">Exclusions (one per line)</label>
          <textarea value={form.exclusions} onChange={(e) => update('exclusions', e.target.value)} className="input-field" rows={3} placeholder={"Airfare\nPersonal expenses\nEntry tickets"} />
        </div>

        <div>
          <label className="block text-sm text-surface-300 mb-1.5">Package Image</label>
          <div className="rounded-2xl border border-dashed border-surface-600/70 bg-surface-900/30 p-4 space-y-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-surface-300 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-500"
            />

            <div className="flex items-center justify-between gap-3 text-xs text-surface-400">
              <p>
                Upload a JPG, PNG, WebP, or AVIF file. The file is uploaded via backend and saved as the package cover image.
              </p>
              <button type="button" onClick={clearImage} className="text-brand-400 hover:text-brand-300 whitespace-nowrap">
                Remove image
              </button>
            </div>

            {imagePreview ? (
              <div className="overflow-hidden rounded-xl border border-surface-700/60 bg-surface-800/60">
                <img src={imagePreview} alt="Package preview" className="h-56 w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border border-surface-700/60 bg-surface-800/40 text-sm text-surface-500">
                No image selected yet
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => navigate('/packages')} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saveMutation.isPending || uploadingImage} className="btn-primary flex-1">
            {uploadingImage ? 'Uploading Image...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Package' : 'Create Package'}
          </button>
        </div>
      </form>
    </div>
  );
}
