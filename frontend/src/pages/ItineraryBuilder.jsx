import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  DocumentArrowDownIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { itinerariesApi } from '../api/itinerariesApi';
import { packagesApi } from '../api/packagesApi';
import { useLeads } from '../hooks/useLeads';
import { formatCurrency, formatDate } from '../utils/formatters';

const blankForm = {
  name: '',
  customerId: '',
  packageId: '',
  destination: '',
  adults: 2,
  children: 0,
  travelStartDate: '',
  travelEndDate: '',
  status: 'DRAFT',
  days: [],
  totalPrice: 0,
};

const steps = ['Trip Basics', 'Package', 'Day Plan', 'Price & Send'];

const templates = [
  {
    label: 'Arrival',
    title: 'Arrival and Check-in',
    description: 'Arrive at the destination, meet the local representative, transfer to the hotel, and enjoy the evening at leisure.',
    hotels: ['Selected hotel'],
    activities: ['Airport pickup', 'Hotel check-in'],
    transports: ['Private transfer'],
  },
  {
    label: 'Sightseeing',
    title: 'Local Sightseeing',
    description: 'Explore the major attractions with a comfortable sightseeing plan and time for photos, food, and shopping.',
    hotels: [],
    activities: ['City tour', 'Local market visit', 'Photo stops'],
    transports: ['Private cab for sightseeing'],
  },
  {
    label: 'Leisure',
    title: 'Leisure Day',
    description: 'Enjoy a relaxed day at the hotel or add optional experiences based on traveller preference.',
    hotels: [],
    activities: ['Day at leisure', 'Optional experiences'],
    transports: [],
  },
  {
    label: 'Checkout',
    title: 'Checkout and Departure',
    description: 'Check out from the hotel and transfer to the airport or station for the return journey.',
    hotels: [],
    activities: ['Breakfast', 'Hotel checkout'],
    transports: ['Departure transfer'],
  },
];

function rupeesToPaise(value) {
  return Number(value || 0) * 100;
}

function paiseToRupees(value) {
  return Math.round(Number(value || 0) / 100);
}

function listFromStrings(items = []) {
  return items.filter(Boolean).map((name) => ({ id: crypto.randomUUID(), name }));
}

function normalizeItems(items = []) {
  return items.map((item) => {
    if (typeof item === 'string') return { id: crypto.randomUUID(), name: item };
    return { id: item.id || crypto.randomUUID(), name: item.name || '' };
  });
}

function normalizeDay(day = {}, index = 0) {
  return {
    id: day.id || crypto.randomUUID(),
    title: day.title || `Day ${day.day || index + 1}`,
    description: day.description || '',
    hotels: normalizeItems(day.hotels || []),
    activities: normalizeItems(day.activities || []),
    transports: normalizeItems(day.transports || []),
  };
}

function templateDay(template) {
  return {
    id: crypto.randomUUID(),
    title: template.title,
    description: template.description,
    hotels: listFromStrings(template.hotels),
    activities: listFromStrings(template.activities),
    transports: listFromStrings(template.transports),
  };
}

function Preview({ form, customer }) {
  const guests = `${Number(form.adults || 0)} adult${Number(form.adults || 0) === 1 ? '' : 's'}${Number(form.children || 0) ? `, ${form.children} child${Number(form.children || 0) === 1 ? '' : 'ren'}` : ''}`;

  return (
    <aside className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)]">
      <div className="border-b border-neutral-100 p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
          <EyeIcon className="h-4 w-4" />
          Customer Preview
        </div>
        <h2 className="text-2xl font-extrabold leading-tight text-neutral-950">{form.name || 'New itinerary proposal'}</h2>
        <p className="mt-1 text-sm text-neutral-500">{form.destination || 'Destination not selected yet'}</p>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <div className="rounded-[var(--radius-md)] bg-neutral-50 p-3">
          <CalendarDaysIcon className="mb-2 h-5 w-5 text-neutral-500" />
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-400">Dates</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">
            {form.travelStartDate ? formatDate(form.travelStartDate, { month: 'short', year: undefined }) : '-'}
            {form.travelEndDate ? ` to ${formatDate(form.travelEndDate, { month: 'short', year: undefined })}` : ''}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-neutral-50 p-3">
          <UserGroupIcon className="mb-2 h-5 w-5 text-neutral-500" />
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-400">Guests</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{guests}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-neutral-50 p-3">
          <CheckCircleIcon className="mb-2 h-5 w-5 text-neutral-500" />
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-400">Price</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{formatCurrency(form.totalPrice)}</p>
        </div>
      </div>

      <div className="space-y-4 px-5 pb-5">
        {customer?.name ? <p className="rounded-[var(--radius-md)] bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">Prepared for {customer.name}</p> : null}
        {form.days.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            Add days to see the customer-ready itinerary here.
          </div>
        ) : (
          form.days.map((day, index) => (
            <div key={day.id} className="border-l-2 border-neutral-900 pl-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">Day {index + 1}</p>
              <h3 className="mt-1 font-bold text-neutral-950">{day.title || 'Untitled day'}</h3>
              {day.description ? <p className="mt-1 text-sm leading-6 text-neutral-600">{day.description}</p> : null}
              {['hotels', 'activities', 'transports'].map((type) => {
                const values = (day[type] || []).map((item) => item.name).filter(Boolean);
                if (!values.length) return null;
                return (
                  <p key={type} className="mt-2 text-xs text-neutral-500">
                    <span className="font-bold capitalize text-neutral-700">{type}:</span> {values.join(', ')}
                  </p>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function DayEditor({ day, index, updateDay, removeDay, duplicateDay, moveDay }) {
  const addItem = (type) => updateDay(day.id, { [type]: [...(day[type] || []), { id: crypto.randomUUID(), name: '' }] });
  const updateItem = (type, itemIndex, value) => {
    const list = [...(day[type] || [])];
    list[itemIndex] = { ...list[itemIndex], name: value };
    updateDay(day.id, { [type]: list });
  };
  const removeItem = (type, itemIndex) => {
    const list = [...(day[type] || [])];
    list.splice(itemIndex, 1);
    updateDay(day.id, { [type]: list });
  };

  return (
    <article className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">Day {index + 1}</p>
          <h3 className="text-lg font-bold text-neutral-950">{day.title || 'Untitled day'}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => moveDay(index, -1)} className="shell-button-ghost px-2" title="Move up"><ArrowUpIcon className="h-4 w-4" /></button>
          <button type="button" onClick={() => moveDay(index, 1)} className="shell-button-ghost px-2" title="Move down"><ArrowDownIcon className="h-4 w-4" /></button>
          <button type="button" onClick={() => duplicateDay(day.id)} className="shell-button-ghost px-2" title="Duplicate day"><DocumentDuplicateIcon className="h-4 w-4" /></button>
          <button type="button" onClick={() => removeDay(day.id)} className="shell-button-ghost px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700" title="Delete day"><TrashIcon className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid gap-4">
        <input className="shell-input-rect font-semibold" placeholder="Day title" value={day.title || ''} onChange={(e) => updateDay(day.id, { title: e.target.value })} />
        <textarea className="shell-input-rect min-h-[92px]" placeholder="Short customer-friendly description" value={day.description || ''} onChange={(e) => updateDay(day.id, { description: e.target.value })} />

        {['hotels', 'activities', 'transports'].map((type) => (
          <section key={type} className="rounded-[var(--radius-md)] bg-neutral-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{type}</span>
              <button type="button" onClick={() => addItem(type)} className="inline-flex items-center gap-1 text-xs font-bold text-neutral-900">
                <PlusIcon className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <div className="space-y-2">
              {(day[type] || []).length === 0 ? <p className="text-xs text-neutral-400">Nothing added yet.</p> : null}
              {(day[type] || []).map((item, itemIndex) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input className="shell-input-rect bg-white py-2 text-sm" placeholder={`Add ${type.slice(0, -1)}`} value={item.name || ''} onChange={(e) => updateItem(type, itemIndex, e.target.value)} />
                  <button type="button" onClick={() => removeItem(type, itemIndex)} className="shell-button-ghost px-2 text-rose-600 hover:bg-rose-50"><TrashIcon className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

export default function ItineraryBuilder() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pdfRef = useRef(null);

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(blankForm);
  const [packageSearch, setPackageSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const { data: leadsData } = useLeads({ pageSize: 500 });
  const { data: packagesData } = useQuery({ queryKey: ['packages'], queryFn: () => packagesApi.list() });
  const itineraryQuery = useQuery({ queryKey: ['itinerary', id], queryFn: () => itinerariesApi.getById(id), enabled: isEdit });

  const customers = useMemo(() => {
    const map = new Map();
    (leadsData?.data?.data || []).forEach((lead) => {
      if (lead.customer && !map.has(lead.customer.id)) map.set(lead.customer.id, lead.customer);
    });
    return Array.from(map.values());
  }, [leadsData]);

  const packages = useMemo(() => packagesData?.data || [], [packagesData]);
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId);
  const selectedPackage = packages.find((pkg) => pkg.id === form.packageId);

  const filteredPackages = useMemo(() => {
    const search = packageSearch.trim().toLowerCase();
    if (!search) return packages;
    return packages.filter((pkg) => [pkg.name, pkg.category, ...(pkg.destinations || [])].filter(Boolean).join(' ').toLowerCase().includes(search));
  }, [packageSearch, packages]);

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter((customer) => [customer.name, customer.phone, customer.email].filter(Boolean).join(' ').toLowerCase().includes(search));
  }, [customerSearch, customers]);

  useEffect(() => {
    if (!isEdit || !itineraryQuery.data?.data) return;
    const itinerary = itineraryQuery.data.data;
    setForm({
      ...blankForm,
      ...itinerary,
      customerId: itinerary.customerId || '',
      packageId: itinerary.packageId || '',
      travelStartDate: itinerary.travelStartDate || '',
      travelEndDate: itinerary.travelEndDate || '',
      days: (itinerary.days || []).map(normalizeDay),
      totalPrice: Number(itinerary.totalPrice || 0),
    });
  }, [isEdit, itineraryQuery.data]);

  useEffect(() => {
    if (selectedPackage) setPackageSearch(selectedPackage.name || '');
    if (selectedCustomer) setCustomerSearch(selectedCustomer.name || '');
  }, [selectedCustomer, selectedPackage]);

  useEffect(() => {
    const closeDropdowns = (event) => {
      if (!event.target.closest('[data-dropdown="package"]')) setShowPackageDropdown(false);
      if (!event.target.closest('[data-dropdown="customer"]')) setShowCustomerDropdown(false);
    };
    document.addEventListener('click', closeDropdowns);
    return () => document.removeEventListener('click', closeDropdowns);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (payload) => (isEdit ? itinerariesApi.update(id, payload) : itinerariesApi.create(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['itineraries'] });
      navigate('/itineraries');
    },
  });

  const updateForm = (updates) => setForm((current) => ({ ...current, ...updates }));

  const selectPackage = (pkg) => {
    if (!pkg) {
      updateForm({ packageId: '' });
      setPackageSearch('');
      setShowPackageDropdown(false);
      return;
    }

    const importedDays = Array.isArray(pkg.itinerary) ? pkg.itinerary.map(normalizeDay) : [];
    const travellers = Number(form.adults || 0) + Number(form.children || 0);
    const packagePrice = Number(pkg.basePrice || 0) * Math.max(travellers, 1);

    updateForm({
      packageId: pkg.id,
      name: form.name || pkg.name || '',
      destination: form.destination || (pkg.destinations || []).join(', '),
      days: importedDays.length ? importedDays : form.days,
      totalPrice: form.totalPrice || packagePrice,
    });
    setPackageSearch(pkg.name || '');
    setShowPackageDropdown(false);
  };

  const addDay = (template) => updateForm({ days: [...form.days, template ? templateDay(template) : normalizeDay({}, form.days.length)] });
  const removeDay = (dayId) => updateForm({ days: form.days.filter((day) => day.id !== dayId) });
  const updateDay = (dayId, updates) => updateForm({ days: form.days.map((day) => (day.id === dayId ? { ...day, ...updates } : day)) });
  const duplicateDay = (dayId) => {
    const day = form.days.find((item) => item.id === dayId);
    if (!day) return;
    const index = form.days.findIndex((item) => item.id === dayId);
    const copy = normalizeDay({ ...day, id: crypto.randomUUID(), title: `${day.title || 'Day'} Copy` });
    updateForm({ days: [...form.days.slice(0, index + 1), copy, ...form.days.slice(index + 1)] });
  };
  const moveDay = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.days.length) return;
    const days = [...form.days];
    const [day] = days.splice(index, 1);
    days.splice(target, 0, day);
    updateForm({ days });
  };

  const saveAs = (status) => saveMutation.mutate({ ...form, status });

  const exportPDF = async () => {
    if (!pdfRef.current) return;
    const canvas = await html2canvas(pdfRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const image = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(image, 'PNG', 0, 0, width, height);
    pdf.save(`Itinerary_${form.name || 'Proposal'}.pdf`);
  };

  const renderStep = () => {
    if (activeStep === 0) {
      return (
        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Client</label>
            <div className="relative mt-1" data-dropdown="customer">
              <input className="shell-input-rect" placeholder="Search client by name or phone" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} onFocus={() => setShowCustomerDropdown(true)} />
              {showCustomerDropdown ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-lg">
                  <button type="button" onClick={() => { updateForm({ customerId: '' }); setCustomerSearch(''); setShowCustomerDropdown(false); }} className="block w-full px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50">No client selected</button>
                  {filteredCustomers.map((customer) => (
                    <button key={customer.id} type="button" onClick={() => { updateForm({ customerId: customer.id }); setCustomerSearch(customer.name || ''); setShowCustomerDropdown(false); }} className="block w-full px-3 py-2 text-left hover:bg-neutral-50">
                      <span className="block text-sm font-semibold text-neutral-900">{customer.name}</span>
                      {customer.phone ? <span className="text-xs text-neutral-500">{customer.phone}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Itinerary Name</label>
            <input className="shell-input-rect mt-1" value={form.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="Example: Bali honeymoon proposal" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Destination</label>
            <input className="shell-input-rect mt-1" value={form.destination} onChange={(e) => updateForm({ destination: e.target.value })} placeholder="Goa, Bali, Dubai..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Start Date</label>
              <input type="date" className="shell-input-rect mt-1" value={form.travelStartDate} onChange={(e) => updateForm({ travelStartDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">End Date</label>
              <input type="date" className="shell-input-rect mt-1" value={form.travelEndDate} onChange={(e) => updateForm({ travelEndDate: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Adults</label>
              <input type="number" min="0" className="shell-input-rect mt-1" value={form.adults} onChange={(e) => updateForm({ adults: Number(e.target.value || 0) })} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Children</label>
              <input type="number" min="0" className="shell-input-rect mt-1" value={form.children} onChange={(e) => updateForm({ children: Number(e.target.value || 0) })} />
            </div>
          </div>
        </div>
      );
    }

    if (activeStep === 1) {
      return (
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lg)] border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex items-start gap-3">
              <SparklesIcon className="mt-0.5 h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-indigo-950">Start from a package to save time</h3>
                <p className="mt-1 text-sm leading-6 text-indigo-800">Import destination, daily plan, and base pricing from your package catalog.</p>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Package Template</label>
            <div className="relative mt-1" data-dropdown="package">
              <input className="shell-input-rect" placeholder="Search packages" value={packageSearch} onChange={(e) => setPackageSearch(e.target.value)} onFocus={() => setShowPackageDropdown(true)} />
              {showPackageDropdown ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-[var(--radius-md)] border border-neutral-200 bg-white shadow-lg">
                  <button type="button" onClick={() => selectPackage(null)} className="block w-full px-3 py-2 text-left text-sm font-medium text-neutral-600 hover:bg-neutral-50">Start blank / custom itinerary</button>
                  {filteredPackages.map((pkg) => (
                    <button key={pkg.id} type="button" onClick={() => selectPackage(pkg)} className="block w-full px-3 py-3 text-left hover:bg-neutral-50">
                      <span className="block text-sm font-bold text-neutral-900">{pkg.name}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{(pkg.destinations || []).join(', ') || pkg.duration || 'Custom package'} - {formatCurrency(pkg.basePrice || 0)} / person</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {selectedPackage ? (
            <div className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">Selected Package</p>
              <h3 className="mt-1 font-bold text-neutral-950">{selectedPackage.name}</h3>
              <p className="mt-1 text-sm text-neutral-500">{selectedPackage.summary || selectedPackage.duration || 'Package itinerary imported.'}</p>
            </div>
          ) : null}
        </div>
      );
    }

    if (activeStep === 2) {
      return (
        <div className="space-y-5">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Quick Day Templates</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {templates.map((template) => (
                <button key={template.label} type="button" onClick={() => addDay(template)} className="shell-button-secondary justify-start">
                  <PlusIcon className="h-4 w-4" />
                  {template.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => addDay()} className="shell-button-primary"><PlusIcon className="h-4 w-4" /> Add Blank Day</button>
          <div className="space-y-4">
            {form.days.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-neutral-200 bg-white p-10 text-center">
                <SparklesIcon className="mx-auto h-8 w-8 text-neutral-300" />
                <h3 className="mt-3 font-bold text-neutral-950">Build the trip day by day</h3>
                <p className="mt-1 text-sm text-neutral-500">Choose a template above or add a blank day.</p>
              </div>
            ) : (
              form.days.map((day, index) => <DayEditor key={day.id} day={day} index={index} updateDay={updateDay} removeDay={removeDay} duplicateDay={duplicateDay} moveDay={moveDay} />)
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Total Selling Price</label>
          <div className="mt-1 flex overflow-hidden rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
            <span className="flex items-center border-r border-neutral-200 px-4 text-sm font-bold text-neutral-500">Rs</span>
            <input type="number" min="0" className="w-full bg-transparent px-4 py-2.5 text-sm text-neutral-900 outline-none" value={paiseToRupees(form.totalPrice)} onChange={(e) => updateForm({ totalPrice: rupeesToPaise(e.target.value) })} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-lg)] bg-neutral-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">Total</p>
            <p className="mt-2 text-2xl font-extrabold">{formatCurrency(form.totalPrice)}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-neutral-100 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Days</p>
            <p className="mt-2 text-2xl font-extrabold text-neutral-950">{form.days.length}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-neutral-100 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Status</p>
            <p className="mt-2 text-2xl font-extrabold text-neutral-950">{form.status}</p>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-4">
          <h3 className="font-bold text-neutral-950">Ready actions</h3>
          <p className="mt-1 text-sm text-neutral-500">Save as draft while planning, or mark as sent once shared with the customer.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => saveAs('DRAFT')} disabled={saveMutation.isPending} className="shell-button-secondary">Save Draft</button>
            <button type="button" onClick={exportPDF} className="shell-button-secondary"><DocumentArrowDownIcon className="h-4 w-4" /> Export PDF</button>
            <button type="button" onClick={() => saveAs('SENT')} disabled={saveMutation.isPending} className="shell-button-primary"><PaperAirplaneIcon className="h-4 w-4" /> Mark Sent</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/itineraries')} className="shell-button-ghost px-2"><ArrowLeftIcon className="h-5 w-5" /></button>
            <div>
              <h1 className="page-heading">{isEdit ? 'Edit Itinerary' : 'Create Itinerary'}</h1>
              <p className="page-subtext">A guided proposal builder for WhatsApp-first travel selling.</p>
            </div>
          </div>
          <button type="button" onClick={() => saveAs(form.status || 'DRAFT')} disabled={saveMutation.isPending} className="shell-button-primary">{saveMutation.isPending ? 'Saving...' : 'Save'}</button>
        </div>

        <div className="grid gap-2 rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-2 md:grid-cols-4">
          {steps.map((step, index) => (
            <button key={step} type="button" onClick={() => setActiveStep(index)} className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left transition ${activeStep === index ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950'}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${activeStep === index ? 'bg-white text-neutral-950' : 'bg-neutral-100 text-neutral-500'}`}>{index + 1}</span>
              <span className="text-sm font-bold">{step}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <main className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-5 md:p-6">
            <div className="mb-6">
              <p className="eyebrow">Step {activeStep + 1} of {steps.length}</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-950">{steps[activeStep]}</h2>
            </div>
            {renderStep()}

            <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-5">
              <button type="button" onClick={() => setActiveStep((step) => Math.max(step - 1, 0))} disabled={activeStep === 0} className="shell-button-secondary disabled:cursor-not-allowed disabled:opacity-40">Back</button>
              {activeStep < steps.length - 1 ? (
                <button type="button" onClick={() => setActiveStep((step) => Math.min(step + 1, steps.length - 1))} className="shell-button-primary">Continue</button>
              ) : (
                <button type="button" onClick={() => saveAs('DRAFT')} disabled={saveMutation.isPending} className="shell-button-primary">{saveMutation.isPending ? 'Saving...' : 'Save Itinerary'}</button>
              )}
            </div>
          </main>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <Preview form={form} customer={selectedCustomer} />
          </div>
        </div>
      </div>

      <div className="fixed -left-[9999px] top-0">
        <div ref={pdfRef} className="w-[800px] bg-white p-10 text-black">
          <Preview form={form} customer={selectedCustomer} />
        </div>
      </div>
    </div>
  );
}
