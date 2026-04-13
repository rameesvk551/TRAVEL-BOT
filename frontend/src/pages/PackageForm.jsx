import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { packagesApi } from '../api/packagesApi';

function formatItineraryForEditor(itinerary = []) {
  if (!Array.isArray(itinerary)) return '';

  return itinerary.map((day, index) => {
    const dayNumber = day?.day || index + 1;
    const title = (day?.title || '').trim();
    const description = (day?.description || '').trim();
    const activities = Array.isArray(day?.activities) ? day.activities.filter(Boolean).join(', ') : '';
    return [`Day ${dayNumber}: ${title}`, description, activities].filter(Boolean).join(' | ');
  }).join('\n');
}

function parseItineraryInput(value = '') {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [headerPart, descriptionPart = '', activitiesPart = ''] = line.split('|').map((part) => part.trim());
      const dayMatch = headerPart.match(/^day\s*(\d+)\s*:\s*(.*)$/i);
      const title = (dayMatch ? dayMatch[2] : headerPart.replace(/^day\s*\d+\s*:?\s*/i, '')).trim();

      return {
        day: dayMatch ? parseInt(dayMatch[1], 10) : index + 1,
        title: title || `Day ${index + 1}`,
        description: descriptionPart || undefined,
        activities: activitiesPart ? activitiesPart.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
      };
    });
}

const initialForm = {
  name: '',
  category: 'DOMESTIC',
  duration: '',
  destinations: '',
  basePrice: '',
  summary: '',
  inclusions: '',
  exclusions: '',
  itinerary: '',
  imageUrl: '',
  brochureUrl: '',
  brochureFileName: '',
};

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

export default function PackageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [brochureFile, setBrochureFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBrochure, setUploadingBrochure] = useState(false);
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

  useQuery({
    queryKey: ['package', id],
    queryFn: () => packagesApi.getById(id),
    enabled: isEdit,
    onSuccess: (data) => {
      const pkg = data.data;
      setForm({
        name: pkg.name || '',
        category: pkg.category || 'DOMESTIC',
        duration: pkg.duration || '',
        destinations: pkg.destinations?.join(', ') || '',
        basePrice: String((pkg.basePrice || 0) / 100),
        summary: pkg.summary || '',
        inclusions: pkg.inclusions?.join('\n') || '',
        exclusions: pkg.exclusions?.join('\n') || '',
        itinerary: formatItineraryForEditor(pkg.itinerary),
        imageUrl: pkg.imageUrl || '',
        brochureUrl: pkg.brochureUrl || '',
        brochureFileName: pkg.brochureFileName || '',
      });
      setImageFile(null);
      setImagePreview(pkg.imageUrl || '');
      setBrochureFile(null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data) => (isEdit ? packagesApi.update(id, data) : packagesApi.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      navigate('/packages');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to save package'),
  });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const uploadImage = async (file) => {
    const response = await packagesApi.uploadImage(file);
    return response?.data?.url;
  };

  const uploadBrochure = async (file) => {
    const response = await packagesApi.uploadBrochure(file);
    return response?.data;
  };

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
    update('imageUrl', '');
  };

  const handleBrochureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setError('Please choose a PDF brochure.');
      event.target.value = '';
      return;
    }
    setError('');
    setBrochureFile(file);
    setForm((current) => ({ ...current, brochureUrl: '', brochureFileName: file.name }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setUploadingImage(true);
      setUploadingBrochure(true);

      let imageUrl = form.imageUrl || null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) throw new Error('Image upload failed');
      }

      let brochureUrl = form.brochureUrl || null;
      let brochureFileName = form.brochureFileName || null;
      if (brochureFile) {
        const uploadedBrochure = await uploadBrochure(brochureFile);
        brochureUrl = uploadedBrochure?.url || null;
        brochureFileName = uploadedBrochure?.fileName || brochureFile.name || null;
        if (!brochureUrl) throw new Error('Brochure upload failed');
      }

      await saveMutation.mutateAsync({
        name: form.name,
        category: form.category || null,
        duration: form.duration,
        destinations: form.destinations.split(',').map((item) => item.trim()).filter(Boolean),
        basePrice: parseInt(form.basePrice, 10) * 100,
        summary: form.summary.trim() || null,
        inclusions: form.inclusions.split('\n').map((item) => item.trim()).filter(Boolean),
        exclusions: form.exclusions.split('\n').map((item) => item.trim()).filter(Boolean),
        itinerary: parseItineraryInput(form.itinerary),
        imageUrl,
        brochureUrl,
        brochureFileName,
      });
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save package');
    } finally {
      setUploadingImage(false);
      setUploadingBrochure(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      <button type="button" onClick={() => navigate('/packages')} className="shell-button-ghost">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Packages
      </button>

      <section>
        <p className="eyebrow">{isEdit ? 'Update package' : 'Create package'}</p>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-slate-950">{isEdit ? 'Edit Package' : 'New Package'}</h1>
        <p className="mt-2 text-sm text-slate-500">Build a polished itinerary that your team can quote consistently across chat, CRM, and booking flow.</p>
      </section>

      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <article className="shell-panel p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Package Name">
                <input value={form.name} onChange={(event) => update('name', event.target.value)} className="shell-input-rect" required />
              </Field>

              <Field label="Category">
                <select value={form.category} onChange={(event) => update('category', event.target.value)} className="shell-input-rect">
                  <option value="DOMESTIC">Domestic</option>
                  <option value="INTERNATIONAL">International</option>
                </select>
              </Field>

              <Field label="Duration">
                <input value={form.duration} onChange={(event) => update('duration', event.target.value)} className="shell-input-rect" placeholder="5 Nights / 6 Days" />
              </Field>

              <Field label="Base Price (Rs./person)">
                <input value={form.basePrice} onChange={(event) => update('basePrice', event.target.value)} className="shell-input-rect" type="number" required />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Destinations" hint="Comma-separated destinations shown on the package card.">
                <input value={form.destinations} onChange={(event) => update('destinations', event.target.value)} className="shell-input-rect" placeholder="Munnar, Alleppey, Kochi" />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="WhatsApp Summary">
                <textarea value={form.summary} onChange={(event) => update('summary', event.target.value)} className="shell-input-rect rounded-[24px]" rows={4} />
              </Field>
            </div>
          </article>

          <article className="shell-panel p-6">
            <Field label="Inclusions">
              <textarea value={form.inclusions} onChange={(event) => update('inclusions', event.target.value)} className="shell-input-rect rounded-[24px]" rows={5} placeholder={'Hotel accommodation\nBreakfast & dinner\nTransfers'} />
            </Field>

            <div className="mt-4">
              <Field label="Exclusions">
                <textarea value={form.exclusions} onChange={(event) => update('exclusions', event.target.value)} className="shell-input-rect rounded-[24px]" rows={4} placeholder={'Airfare\nPersonal expenses\nEntry tickets'} />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Itinerary" hint="Format each line as: Day X: Title | Description | Activity 1, Activity 2">
                <textarea value={form.itinerary} onChange={(event) => update('itinerary', event.target.value)} className="shell-input-rect rounded-[24px]" rows={8} />
              </Field>
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="shell-panel p-6">
            <Field label="Package Image">
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-4">
                <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-[#0d6a5f] file:px-4 file:py-2.5 file:font-semibold file:text-white hover:file:bg-[#0b5d54]" />
                <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Package preview" className="h-64 w-full object-cover" />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-slate-400">No image selected yet</div>
                  )}
                </div>
              </div>
            </Field>
          </article>

          <article className="shell-panel p-6">
            <Field label="Brochure PDF" hint="Upload the brochure that should be sent after package details.">
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-4">
                <input type="file" accept="application/pdf,.pdf" onChange={handleBrochureChange} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-[#0d6a5f] file:px-4 file:py-2.5 file:font-semibold file:text-white hover:file:bg-[#0b5d54]" />
                <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                  {brochureFile?.name || form.brochureFileName || 'No brochure selected yet'}
                </div>
              </div>
            </Field>
          </article>

          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/packages')} className="shell-button-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending || uploadingImage || uploadingBrochure} className="shell-button-primary flex-1">
              {uploadingImage || uploadingBrochure ? 'Uploading...' : saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Package' : 'Create Package'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
