import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { itinerariesApi } from '../api/itinerariesApi';
import { itineraryTemplatesApi } from '../api/itineraryTemplatesApi';
import { packagesApi } from '../api/packagesApi';
import { useLeads } from '../hooks/useLeads';
import { useAuthStore } from '../store/authStore';
import { renderPreviewHtml } from '../utils/documentBuilder';
import { formatCurrency } from '../utils/formatters';

const STEPS = ['Trip Basics', 'Day Plan', 'Hotels & Vehicle', 'Pricing', 'Design & Send'];

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const DEFAULT_VEHICLE_FEATURES = [
  'Commercial Vehicle', 'Vehicle Insurance', 'Driver Allowance Included',
  'Toll & Parking Fee Included', 'AC Vehicle', '24x7 On Call Assistance',
];

const blankForm = {
  name: '',
  customerId: '',
  packageId: '',
  leadId: '',
  templateId: '',
  destination: '',
  productCode: '',
  summary: '',
  status: 'DRAFT',
  adults: 2,
  children: 0,
  travelStartDate: '',
  travelEndDate: '',
  days: [],
  hotels: [],
  vehicle: { type: '', features: [] },
  priceRooms: [],
  pricing: { currency: '₹', gstPercent: 5 },
  inclusions: [],
  exclusions: [],
  pdfUrl: '',
};

const dayTemplates = [
  { label: 'Arrival', title: 'Arrival and Check-in', description: 'Arrive at the destination, meet the local representative, transfer to the hotel and relax in the evening.' },
  { label: 'Sightseeing', title: 'Local Sightseeing', description: 'Explore the major attractions with a comfortable sightseeing plan and time for photos, food and shopping.' },
  { label: 'Leisure', title: 'Leisure Day', description: 'Enjoy a relaxed day at the hotel or add optional experiences based on traveller preference.' },
  { label: 'Checkout', title: 'Checkout and Departure', description: 'Check out from the hotel and transfer to the airport or station for the return journey.' },
];

function formatDMY(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  const s = new Date(a); const e = new Date(b);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.max(0, Math.round((e - s) / 86400000));
}

/** Computes the pricing block (rupees) from the price-room rows + GST %. */
function computePricing(form) {
  const rooms = (form.priceRooms || []).map((r) => ({ ...r, amount: num(r.amount) || num(r.rate) * (num(r.pax) || 1) }));
  const packageTotal = rooms.reduce((s, r) => s + r.amount, 0);
  const gstPercent = num(form.pricing?.gstPercent);
  const gstAmount = Math.round((packageTotal * gstPercent) / 100 * 100) / 100;
  const grossTotal = packageTotal + gstAmount;
  return { currency: '₹', packageTotal, gstPercent, gstAmount, grossTotal };
}

/** Maps the editor form to the data shape the itinerary template expects. */
function buildPreviewData(form, agency, customer) {
  const plan = (form.days || []).map((d) => ({ title: d.title || '', description: d.description || '', date: d.date ? formatDMY(d.date) : '' }));
  const hotels = (form.hotels || []).map((h) => ({
    name: h.name || '', category: h.category || '', city: h.city || '', nights: h.nights || '',
    roomType: h.roomType || '', mealPlan: h.mealPlan || '', imageUrl: h.imageUrl || '',
  }));
  const vehicle = { type: form.vehicle?.type || '', features: (form.vehicle?.features || []).filter(Boolean) };
  const priceRooms = (form.priceRooms || []).map((r) => ({ label: r.label || '', rate: num(r.rate), pax: num(r.pax), amount: num(r.amount) || num(r.rate) * (num(r.pax) || 1) }));
  const pricing = computePricing(form);
  const nights = nightsBetween(form.travelStartDate, form.travelEndDate) || hotels.reduce((s, h) => s + num(h.nights), 0) || Math.max(0, plan.length - 1);
  return {
    agency: { ...(agency || {}), website: agency?.customDomain || agency?.subdomain || '' },
    customer: customer ? { name: customer.name, phone: customer.phone, email: customer.email } : {},
    doc: { type: 'itinerary', title: 'TRAVEL ITINERARY', number: form.productCode || '', date: '' },
    trip: {
      productCode: form.productCode || '', summary: form.summary || form.destination || '',
      packageName: form.name || '', subtitle: form.summary && form.destination ? form.destination : '',
      nights, daysCount: plan.length, checkIn: formatDMY(form.travelStartDate), checkOut: formatDMY(form.travelEndDate),
      adults: num(form.adults), children: num(form.children), destination: form.destination || '',
    },
    itinerary: { plan, hotels, vehicle, priceRooms, pricing, inclusions: (form.inclusions || []).filter(Boolean), exclusions: (form.exclusions || []).filter(Boolean) },
  };
}

function StringListEditor({ label, items, onChange, placeholder }) {
  return (
    <section className="rounded-[var(--radius-md)] bg-neutral-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{label}</span>
        <button type="button" onClick={() => onChange([...(items || []), ''])} className="inline-flex items-center gap-1 text-xs font-bold text-neutral-900"><PlusIcon className="h-3.5 w-3.5" /> Add</button>
      </div>
      <div className="space-y-2">
        {(items || []).length === 0 ? <p className="text-xs text-neutral-400">Nothing added yet.</p> : null}
        {(items || []).map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="shell-input-rect bg-white py-2 text-sm" placeholder={placeholder} value={value} onChange={(e) => { const next = [...items]; next[i] = e.target.value; onChange(next); }} />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="shell-button-ghost px-2 text-rose-600 hover:bg-rose-50"><TrashIcon className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ItineraryBuilder() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agency = useAuthStore((s) => s.agency);

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  const { data: leadsData } = useLeads({ pageSize: 500 });
  const { data: packagesData } = useQuery({ queryKey: ['packages'], queryFn: () => packagesApi.list() });
  const { data: templatesData } = useQuery({ queryKey: ['itinerary-templates'], queryFn: () => itineraryTemplatesApi.list() });
  const { data: presetsData } = useQuery({ queryKey: ['itinerary-template-presets'], queryFn: () => itineraryTemplatesApi.listPresets() });
  const itineraryQuery = useQuery({ queryKey: ['itinerary', id], queryFn: () => itinerariesApi.getById(id), enabled: isEdit });

  const customers = useMemo(() => {
    const map = new Map();
    (leadsData?.data?.data || []).forEach((lead) => { if (lead.customer && !map.has(lead.customer.id)) map.set(lead.customer.id, lead.customer); });
    return Array.from(map.values());
  }, [leadsData]);

  const packages = useMemo(() => packagesData?.data || [], [packagesData]);
  const templates = useMemo(() => templatesData?.data || [], [templatesData]);
  const presets = presetsData?.data?.presets || [];
  const defaultConfig = presetsData?.data?.defaultConfig || {};
  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  useEffect(() => {
    if (!isEdit || !itineraryQuery.data?.data) return;
    const it = itineraryQuery.data.data;
    setForm({
      ...blankForm,
      ...it,
      customerId: it.customerId || '',
      packageId: it.packageId || '',
      templateId: it.templateId || '',
      travelStartDate: it.travelStartDate || '',
      travelEndDate: it.travelEndDate || '',
      days: Array.isArray(it.days) ? it.days.map((d) => ({ id: d.id || uid(), title: d.title || '', description: d.description || '', date: d.date || '' })) : [],
      hotels: Array.isArray(it.hotels) ? it.hotels.map((h) => ({ id: uid(), ...h })) : [],
      vehicle: { type: it.vehicle?.type || '', features: it.vehicle?.features || [] },
      priceRooms: Array.isArray(it.priceRooms) ? it.priceRooms.map((r) => ({ id: uid(), ...r })) : [],
      pricing: { currency: '₹', gstPercent: it.pricing?.gstPercent ?? 5 },
      inclusions: it.inclusions || [],
      exclusions: it.exclusions || [],
    });
  }, [isEdit, itineraryQuery.data]);

  const update = (patch) => setForm((cur) => ({ ...cur, ...patch }));

  // Live preview HTML (selected template, or default modern preset).
  const previewHtml = useMemo(() => {
    const tpl = templates.find((t) => t.id === form.templateId) || templates.find((t) => t.isDefault) || templates[0] || null;
    const html = tpl?.htmlContent || (presets.find((p) => p.key === 'modern') || presets[0])?.html || '';
    const config = tpl?.config || defaultConfig;
    if (!html) return '';
    return renderPreviewHtml(html, config, defaultConfig, buildPreviewData(form, agency, selectedCustomer));
  }, [templates, presets, defaultConfig, form, agency, selectedCustomer]);

  const buildPayload = (status = form.status || 'DRAFT') => {
    const pricing = computePricing(form);
    return {
      ...form,
      status,
      customerId: form.customerId || null,
      packageId: form.packageId || null,
      leadId: form.leadId || null,
      templateId: form.templateId || null,
      destination: form.destination || null,
      productCode: form.productCode || null,
      summary: form.summary || null,
      travelStartDate: form.travelStartDate || null,
      travelEndDate: form.travelEndDate || null,
      pdfUrl: form.pdfUrl || null,
      adults: num(form.adults),
      children: num(form.children),
      days: (form.days || []).map(({ id: _id, ...d }) => d),
      hotels: (form.hotels || []).map(({ id: _id, ...h }) => h),
      vehicle: { type: form.vehicle?.type || '', features: (form.vehicle?.features || []).filter(Boolean) },
      priceRooms: (form.priceRooms || []).map(({ id: _id, ...r }) => ({ ...r, rate: num(r.rate), pax: num(r.pax), amount: num(r.amount) || num(r.rate) * (num(r.pax) || 1) })),
      pricing,
      inclusions: (form.inclusions || []).filter(Boolean),
      exclusions: (form.exclusions || []).filter(Boolean),
    };
  };

  const saveMutation = useMutation({
    mutationFn: (payload) => (isEdit ? itinerariesApi.update(id, payload) : itinerariesApi.create(payload)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['itineraries'] });
      if (!isEdit && res?.data?.id) navigate(`/itineraries/${res.data.id}/edit`, { replace: true });
    },
  });

  const ensureSaved = async (status = form.status || 'DRAFT') => {
    if (!form.name.trim()) { toast.error('Add an itinerary name first'); setActiveStep(0); return null; }
    const payload = buildPayload(status);
    const res = isEdit ? await itinerariesApi.update(id, payload) : await itinerariesApi.create(payload);
    qc.invalidateQueries({ queryKey: ['itineraries'] });
    const saved = res.data;
    if (!isEdit && saved?.id) navigate(`/itineraries/${saved.id}/edit`, { replace: true });
    return saved;
  };

  const saveAs = (status) => {
    if (!form.name.trim()) { toast.error('Add an itinerary name first'); setActiveStep(0); return; }
    saveMutation.mutate(buildPayload(status), { onSuccess: () => toast.success('Itinerary saved') });
  };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const saved = await ensureSaved();
      if (!saved?.id) return;
      const blob = await itinerariesApi.downloadPdf(saved.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(form.name || 'itinerary').replace(/[^\w\-]+/g, '_')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to generate PDF');
    } finally { setBusy(false); }
  };

  const sendWhatsApp = async () => {
    if (!form.customerId) { toast.error('Select a customer (with a WhatsApp number) first'); setActiveStep(0); return; }
    setBusy(true);
    try {
      const saved = await ensureSaved('SENT');
      if (!saved?.id) return;
      await itinerariesApi.sendWhatsApp(saved.id);
      update({ status: 'SENT' });
      toast.success('Itinerary sent on WhatsApp');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to send on WhatsApp');
    } finally { setBusy(false); }
  };

  // ---- day helpers ----
  const addDay = (tpl) => update({ days: [...form.days, { id: uid(), title: tpl?.title || '', description: tpl?.description || '', date: '' }] });
  const updateDay = (dayId, patch) => update({ days: form.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)) });
  const removeDay = (dayId) => update({ days: form.days.filter((d) => d.id !== dayId) });
  const duplicateDay = (dayId) => {
    const i = form.days.findIndex((d) => d.id === dayId);
    if (i < 0) return;
    const copy = { ...form.days[i], id: uid() };
    update({ days: [...form.days.slice(0, i + 1), copy, ...form.days.slice(i + 1)] });
  };
  const moveDay = (i, dir) => {
    const t = i + dir; if (t < 0 || t >= form.days.length) return;
    const days = [...form.days]; const [d] = days.splice(i, 1); days.splice(t, 0, d); update({ days });
  };

  // ---- hotel helpers ----
  const addHotel = () => update({ hotels: [...form.hotels, { id: uid(), name: '', category: '3 Star', city: '', nights: '', roomType: '', mealPlan: '' }] });
  const updateHotel = (hid, patch) => update({ hotels: form.hotels.map((h) => (h.id === hid ? { ...h, ...patch } : h)) });
  const removeHotel = (hid) => update({ hotels: form.hotels.filter((h) => h.id !== hid) });

  // ---- price-room helpers ----
  const addRoom = () => update({ priceRooms: [...form.priceRooms, { id: uid(), label: '', rate: '', pax: '', amount: '' }] });
  const updateRoom = (rid, patch) => update({ priceRooms: form.priceRooms.map((r) => (r.id === rid ? { ...r, ...patch } : r)) });
  const removeRoom = (rid) => update({ priceRooms: form.priceRooms.filter((r) => r.id !== rid) });

  const selectPackage = (pkg) => {
    if (!pkg) { update({ packageId: '' }); return; }
    const importedDays = Array.isArray(pkg.itinerary) ? pkg.itinerary.map((d, i) => ({ id: uid(), title: d.title || `Day ${i + 1}`, description: d.description || '', date: '' })) : [];
    update({
      packageId: pkg.id,
      name: form.name || pkg.name || '',
      destination: form.destination || (pkg.destinations || []).join(', '),
      summary: form.summary || pkg.summary || '',
      days: importedDays.length ? importedDays : form.days,
    });
    toast.success('Imported from package');
  };

  const pricing = computePricing(form);

  const renderStep = () => {
    if (activeStep === 0) {
      return (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Itinerary Name"><input className="shell-input-rect" value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Himachal 4N/5D Itinerary" /></Field>
            <Field label="Product Code"><input className="shell-input-rect" value={form.productCode} onChange={(e) => update({ productCode: e.target.value })} placeholder="TS0170-RGPJS" /></Field>
            <Field label="Destination"><input className="shell-input-rect" value={form.destination} onChange={(e) => update({ destination: e.target.value })} placeholder="Shimla, Manali" /></Field>
            <Field label="Summary / route line"><input className="shell-input-rect" value={form.summary} onChange={(e) => update({ summary: e.target.value })} placeholder="Shimla 2N · Manali 2N" /></Field>
            <Field label="Check In"><input type="date" className="shell-input-rect" value={form.travelStartDate || ''} onChange={(e) => update({ travelStartDate: e.target.value })} /></Field>
            <Field label="Check Out"><input type="date" className="shell-input-rect" value={form.travelEndDate || ''} onChange={(e) => update({ travelEndDate: e.target.value })} /></Field>
            <Field label="Adults"><input type="number" min="0" className="shell-input-rect" value={form.adults} onChange={(e) => update({ adults: e.target.value })} /></Field>
            <Field label="Children"><input type="number" min="0" className="shell-input-rect" value={form.children} onChange={(e) => update({ children: e.target.value })} /></Field>
            <Field label="Customer">
              <select className="shell-input-rect" value={form.customerId} onChange={(e) => update({ customerId: e.target.value })}>
                <option value="">— Select customer —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Start from a Package (optional)">
              <select className="shell-input-rect" value={form.packageId} onChange={(e) => selectPackage(packages.find((p) => p.id === e.target.value) || null)}>
                <option value="">— Blank / custom —</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
        </div>
      );
    }

    if (activeStep === 1) {
      return (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {dayTemplates.map((t) => <button key={t.label} type="button" onClick={() => addDay(t)} className="shell-button-secondary justify-start"><PlusIcon className="h-4 w-4" /> {t.label}</button>)}
            <button type="button" onClick={() => addDay()} className="shell-button-primary"><PlusIcon className="h-4 w-4" /> Blank Day</button>
          </div>
          {form.days.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-neutral-200 bg-white p-10 text-center">
              <SparklesIcon className="mx-auto h-8 w-8 text-neutral-300" />
              <p className="mt-2 text-sm text-neutral-500">Add days to build the day-by-day plan.</p>
            </div>
          ) : form.days.map((day, i) => (
            <article key={day.id} className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">Day {i + 1}</p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveDay(i, -1)} className="shell-button-ghost px-2"><ArrowUpIcon className="h-4 w-4" /></button>
                  <button type="button" onClick={() => moveDay(i, 1)} className="shell-button-ghost px-2"><ArrowDownIcon className="h-4 w-4" /></button>
                  <button type="button" onClick={() => duplicateDay(day.id)} className="shell-button-ghost px-2"><DocumentDuplicateIcon className="h-4 w-4" /></button>
                  <button type="button" onClick={() => removeDay(day.id)} className="shell-button-ghost px-2 text-rose-600 hover:bg-rose-50"><TrashIcon className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid gap-3">
                <input className="shell-input-rect font-semibold" placeholder="Day title" value={day.title} onChange={(e) => updateDay(day.id, { title: e.target.value })} />
                <textarea className="shell-input-rect min-h-[90px]" placeholder="Customer-friendly description" value={day.description} onChange={(e) => updateDay(day.id, { description: e.target.value })} />
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (activeStep === 2) {
      return (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-neutral-950">Hotels</h3>
              <button type="button" onClick={addHotel} className="shell-button-secondary"><PlusIcon className="h-4 w-4" /> Add Hotel</button>
            </div>
            <div className="space-y-3">
              {form.hotels.length === 0 ? <p className="text-sm text-neutral-400">No hotels added.</p> : form.hotels.map((h) => (
                <div key={h.id} className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="shell-input-rect" placeholder="Hotel name" value={h.name} onChange={(e) => updateHotel(h.id, { name: e.target.value })} />
                    <input className="shell-input-rect" placeholder="City" value={h.city} onChange={(e) => updateHotel(h.id, { city: e.target.value })} />
                    <input className="shell-input-rect" placeholder="Category (e.g. 3 Star)" value={h.category} onChange={(e) => updateHotel(h.id, { category: e.target.value })} />
                    <input type="number" min="0" className="shell-input-rect" placeholder="Nights" value={h.nights} onChange={(e) => updateHotel(h.id, { nights: e.target.value })} />
                    <input className="shell-input-rect" placeholder="Room type" value={h.roomType} onChange={(e) => updateHotel(h.id, { roomType: e.target.value })} />
                    <input className="shell-input-rect" placeholder="Meal plan (e.g. Breakfast and Dinner)" value={h.mealPlan} onChange={(e) => updateHotel(h.id, { mealPlan: e.target.value })} />
                  </div>
                  <div className="mt-2 text-right"><button type="button" onClick={() => removeHotel(h.id)} className="text-xs font-semibold text-rose-600">Remove hotel</button></div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
            <h3 className="mb-3 font-bold text-neutral-950">Vehicle</h3>
            <Field label="Vehicle type"><input className="shell-input-rect" placeholder="Sedan (4 Seater)" value={form.vehicle?.type || ''} onChange={(e) => update({ vehicle: { ...form.vehicle, type: e.target.value } })} /></Field>
            <div className="mt-3">
              {(form.vehicle?.features || []).length === 0 && (
                <button type="button" onClick={() => update({ vehicle: { ...form.vehicle, features: DEFAULT_VEHICLE_FEATURES } })} className="mb-2 text-xs font-semibold text-indigo-600">+ Add common vehicle features</button>
              )}
              <StringListEditor label="Vehicle features" items={form.vehicle?.features || []} onChange={(features) => update({ vehicle: { ...form.vehicle, features } })} placeholder="e.g. AC Vehicle" />
            </div>
          </div>
        </div>
      );
    }

    if (activeStep === 3) {
      return (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-neutral-950">Price Breakup</h3>
              <button type="button" onClick={addRoom} className="shell-button-secondary"><PlusIcon className="h-4 w-4" /> Add Row</button>
            </div>
            <div className="space-y-3">
              {form.priceRooms.length === 0 ? <p className="text-sm text-neutral-400">No price rows yet.</p> : form.priceRooms.map((r) => (
                <div key={r.id} className="grid items-center gap-2 sm:grid-cols-[2fr_1fr_0.7fr_1fr_auto]">
                  <input className="shell-input-rect" placeholder="Room 1: Double Sharing" value={r.label} onChange={(e) => updateRoom(r.id, { label: e.target.value })} />
                  <input type="number" min="0" className="shell-input-rect" placeholder="Rate" value={r.rate} onChange={(e) => updateRoom(r.id, { rate: e.target.value })} />
                  <input type="number" min="0" className="shell-input-rect" placeholder="Pax" value={r.pax} onChange={(e) => updateRoom(r.id, { pax: e.target.value })} />
                  <input type="number" min="0" className="shell-input-rect" placeholder="Amount (auto)" value={r.amount} onChange={(e) => updateRoom(r.id, { amount: e.target.value })} />
                  <button type="button" onClick={() => removeRoom(r.id)} className="shell-button-ghost px-2 text-rose-600 hover:bg-rose-50"><TrashIcon className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-4 max-w-xs">
              <Field label="GST %"><input type="number" min="0" className="shell-input-rect" value={form.pricing?.gstPercent ?? 0} onChange={(e) => update({ pricing: { ...form.pricing, gstPercent: e.target.value } })} /></Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Package Total" value={formatCurrency(pricing.packageTotal * 100)} />
              <Stat label={`GST @ ${pricing.gstPercent}%`} value={formatCurrency(pricing.gstAmount * 100)} />
              <Stat label="Gross Total" value={formatCurrency(pricing.grossTotal * 100)} dark />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <StringListEditor label="Inclusions" items={form.inclusions} onChange={(inclusions) => update({ inclusions })} placeholder="e.g. Daily breakfast and dinner" />
            <StringListEditor label="Exclusions" items={form.exclusions} onChange={(exclusions) => update({ exclusions })} placeholder="e.g. Flights and trains" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <Field label="Template theme">
          <select className="shell-input-rect" value={form.templateId} onChange={(e) => update({ templateId: e.target.value })}>
            <option value="">{templates.length ? 'Default template' : 'No templates yet — using default theme'}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
          </select>
        </Field>
        {templates.length === 0 && (
          <p className="text-sm text-neutral-500">Tip: create reusable themes (colours, logo, background image) under <button type="button" className="font-semibold text-indigo-600" onClick={() => navigate('/settings/itinerary-templates')}>Settings → Itinerary Templates</button>.</p>
        )}
        <div className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
          <h3 className="font-bold text-neutral-950">Ready actions</h3>
          <p className="mt-1 text-sm text-neutral-500">Download the PDF, or mark Sent to deliver it to the customer on WhatsApp.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => saveAs('DRAFT')} disabled={saveMutation.isPending} className="shell-button-secondary">Save Draft</button>
            <button type="button" onClick={downloadPdf} disabled={busy} className="shell-button-secondary"><DocumentArrowDownIcon className="h-4 w-4" /> {busy ? 'Working…' : 'Download PDF'}</button>
            <button type="button" onClick={sendWhatsApp} disabled={busy} className="shell-button-primary"><PaperAirplaneIcon className="h-4 w-4" /> {busy ? 'Sending…' : 'Send on WhatsApp'}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/itineraries')} className="shell-button-ghost px-2"><ArrowLeftIcon className="h-5 w-5" /></button>
            <div>
              <h1 className="page-heading">{isEdit ? 'Edit Itinerary' : 'Create Itinerary'}</h1>
              <p className="page-subtext">Build a polished, branded travel itinerary with a live preview.</p>
            </div>
          </div>
          <button type="button" onClick={() => saveAs(form.status || 'DRAFT')} disabled={saveMutation.isPending} className="shell-button-primary">{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
        </div>

        <div className="grid gap-2 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-2 md:grid-cols-5">
          {STEPS.map((step, i) => (
            <button key={step} type="button" onClick={() => setActiveStep(i)} className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left transition ${activeStep === i ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950'}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${activeStep === i ? 'bg-white text-neutral-950' : 'bg-neutral-100 text-neutral-500'}`}>{i + 1}</span>
              <span className="text-sm font-bold">{step}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
          <main className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-5 md:p-6">
            <div className="mb-6">
              <p className="eyebrow">Step {activeStep + 1} of {STEPS.length}</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-950">{STEPS[activeStep]}</h2>
            </div>
            {renderStep()}
            <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-5">
              <button type="button" onClick={() => setActiveStep((s) => Math.max(s - 1, 0))} disabled={activeStep === 0} className="shell-button-secondary disabled:opacity-40">Back</button>
              {activeStep < STEPS.length - 1
                ? <button type="button" onClick={() => setActiveStep((s) => Math.min(s + 1, STEPS.length - 1))} className="shell-button-primary">Continue</button>
                : <button type="button" onClick={() => saveAs('DRAFT')} disabled={saveMutation.isPending} className="shell-button-primary">{saveMutation.isPending ? 'Saving…' : 'Save Itinerary'}</button>}
            </div>
          </main>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Live Preview</p>
              <span className="text-xs text-neutral-400">Matches the PDF</span>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-neutral-200 bg-white shadow-sm">
              <iframe title="itinerary-preview" sandbox="" srcDoc={previewHtml} className="h-[1000px] w-full border-0" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Stat({ label, value, dark }) {
  return (
    <div className={`rounded-[var(--radius-lg)] p-4 ${dark ? 'bg-neutral-950 text-white' : 'bg-neutral-100'}`}>
      <p className={`text-xs font-bold uppercase tracking-[0.14em] ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{label}</p>
      <p className={`mt-2 text-xl font-extrabold ${dark ? '' : 'text-neutral-950'}`}>{value}</p>
    </div>
  );
}
