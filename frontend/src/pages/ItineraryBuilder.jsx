import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itinerariesApi } from '../api/itinerariesApi';
import { packagesApi } from '../api/packagesApi';
import { useLeads } from '../hooks/useLeads';
import { ArrowLeftIcon, PlusIcon, TrashIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../utils/formatters';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableDay({ day, index, updateDay, removeDay }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: day.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const addItem = (type) => {
    updateDay(day.id, {
      [type]: [...(day[type] || []), { id: crypto.randomUUID(), name: '' }]
    });
  };

  const updateItem = (type, itemIndex, field, value) => {
    const list = [...(day[type] || [])];
    list[itemIndex] = { ...list[itemIndex], [field]: value };
    updateDay(day.id, { [type]: list });
  };

  const removeItem = (type, itemIndex) => {
    const list = [...(day[type] || [])];
    list.splice(itemIndex, 1);
    updateDay(day.id, { [type]: list });
  };

  return (
    <div ref={setNodeRef} style={style} className="shell-panel p-5 mb-4 group border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab p-1 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
          </div>
          <h3 className="font-bold text-slate-900">Day {index + 1}</h3>
        </div>
        <button type="button" onClick={() => removeDay(day.id)} className="text-slate-400 hover:text-rose-500 transition">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <input 
          className="shell-input-rect font-semibold" 
          placeholder="Day Title (e.g., Arrival in Paris)" 
          value={day.title || ''} 
          onChange={e => updateDay(day.id, { title: e.target.value })} 
        />
        <textarea 
          className="shell-input-rect min-h-[80px]" 
          placeholder="Description" 
          value={day.description || ''} 
          onChange={e => updateDay(day.id, { description: e.target.value })} 
        />

        {/* Dynamic Lists */}
        {['hotels', 'activities', 'transports'].map(type => (
          <div key={type} className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-slate-500 tracking-wider flex-1">{type}</span>
              <button type="button" onClick={() => addItem(type)} className="text-[#2d2d2d] text-xs font-semibold hover:underline">
                + Add
              </button>
            </div>
            
            <div className="space-y-2">
              {(day[type] || []).map((item, i) => (
                <div key={item.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <input className="flex-1 shell-input py-1.5 px-3 text-xs bg-white" placeholder="Name" value={item.name} onChange={e => updateItem(type, i, 'name', e.target.value)} />
                  <button type="button" onClick={() => removeItem(type, i)} className="text-slate-400 hover:text-rose-500"><TrashIcon className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ItineraryBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;
  const pdfRef = useRef();

  const [form, setForm] = useState({
    name: '', customerId: '', packageId: '', destination: '', adults: 2, children: 0,
    travelStartDate: '', travelEndDate: '', status: 'DRAFT', days: [], totalPrice: 0
  });

  const [packageSearch, setPackageSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const { data: leadsData } = useLeads({ pageSize: 500 });
  const { data: packagesData } = useQuery({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
  });

  const customers = useMemo(() => {
    const map = new Map();
    (leadsData?.data?.data || []).forEach(lead => {
      if (lead.customer && !map.has(lead.customer.id)) {
        map.set(lead.customer.id, lead.customer);
      }
    });
    return Array.from(map.values());
  }, [leadsData]);

  const packages = useMemo(() => packagesData?.data || [], [packagesData]);

  // Filtered lists based on search
  const filteredPackages = useMemo(() => {
    if (!packageSearch) return packages;
    return packages.filter(p => p.name.toLowerCase().includes(packageSearch.toLowerCase()));
  }, [packages, packageSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
  }, [customers, customerSearch]);

  const itineraryQuery = useQuery({
    queryKey: ['itinerary', id],
    queryFn: () => itinerariesApi.getById(id),
    enabled: isEdit,
  });

  useEffect(() => {
    if (isEdit && itineraryQuery.data?.data) {
      const it = itineraryQuery.data.data;
      const pkg = packages.find(p => p.id === it.packageId);
      const cust = customers.find(c => c.id === it.customerId);
      setForm({ ...it, customerId: it.customerId || '', packageId: it.packageId || '', travelStartDate: it.travelStartDate || '', travelEndDate: it.travelEndDate || '' });
      if (pkg) setPackageSearch(pkg.name);
      if (cust) setCustomerSearch(cust.name);
    }
  }, [isEdit, itineraryQuery.data]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-dropdown="package"]')) {
        setShowPackageDropdown(false);
      }
      if (!e.target.closest('[data-dropdown="customer"]')) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit ? itinerariesApi.update(id, payload) : itinerariesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries(['itineraries']);
      navigate('/itineraries');
    }
  });

  const handleExportPDF = async () => {
    if (!pdfRef.current) return;
    const canvas = await html2canvas(pdfRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Itinerary_${form.name || 'Export'}.pdf`);
  };

  const addDay = () => setForm(f => ({ ...f, days: [...f.days, { id: crypto.randomUUID(), title: '', description: '', hotels: [], activities: [], transports: [] }] }));
  const removeDay = (dayId) => setForm(f => ({ ...f, days: f.days.filter(d => d.id !== dayId) }));
  const updateDay = (dayId, updates) => setForm(f => ({ ...f, days: f.days.map(d => d.id === dayId ? { ...d, ...updates } : d) }));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setForm((f) => {
        const oldIndex = f.days.findIndex(d => d.id === active.id);
        const newIndex = f.days.findIndex(d => d.id === over.id);
        return { ...f, days: arrayMove(f.days, oldIndex, newIndex) };
      });
    }
  };

  // Calculations - simplified to use totalPrice from form
  const calcTotals = () => {
    return { 
      cost: 0, 
      price: Number(form.totalPrice || 0), 
      profit: 0, 
      margin: 0 
    };
  };

  const totals = calcTotals();

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-white">
      
      {/* LEFT PANEL: Trip Details */}
      <div className="w-full lg:w-80 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto z-10 flex-shrink-0">
        <button onClick={() => navigate('/itineraries')} className="shell-button-ghost mb-6 -ml-3">
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
        
        <h2 className="text-xl font-bold text-slate-900 mb-6">Trip Details</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Itinerary Name</label>
            <input className="shell-input-rect mt-1" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Summer in Swiss" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Package (Optional)</label>
            <div className="relative mt-1" data-dropdown="package">
              <input 
                type="text"
                className="shell-input-rect w-full"
                placeholder="Search packages..."
                value={packageSearch}
                onChange={e => setPackageSearch(e.target.value)}
                onFocus={() => setShowPackageDropdown(true)}
              />
              {showPackageDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  <div 
                    className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                    onClick={() => {
                      setForm({...form, packageId: ''});
                      setPackageSearch('');
                      setShowPackageDropdown(false);
                    }}
                  >
                    -- No Package / Custom Itinerary --
                  </div>
                  {filteredPackages.map(p => (
                    <div 
                      key={p.id}
                      className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                      onClick={() => {
                        setForm({...form, packageId: p.id});
                        setPackageSearch(p.name);
                        setShowPackageDropdown(false);
                      }}
                    >
                      {p.name}
                    </div>
                  ))}
                  {filteredPackages.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500 text-center">No packages found</div>
                  )}
                </div>
              )}
              {form.packageId && (
                <div className="mt-1 text-xs text-slate-500">
                  Selected: {packages.find(p => p.id === form.packageId)?.name}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Client (Optional)</label>
            <div className="relative mt-1" data-dropdown="customer">
              <input 
                type="text"
                className="shell-input-rect w-full"
                placeholder="Search clients..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                onFocus={() => setShowCustomerDropdown(true)}
              />
              {showCustomerDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  <div 
                    className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                    onClick={() => {
                      setForm({...form, customerId: ''});
                      setCustomerSearch('');
                      setShowCustomerDropdown(false);
                    }}
                  >
                    -- Select Client --
                  </div>
                  {filteredCustomers.map(c => (
                    <div 
                      key={c.id}
                      className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                      onClick={() => {
                        setForm({...form, customerId: c.id});
                        setCustomerSearch(c.name);
                        setShowCustomerDropdown(false);
                      }}
                    >
                      {c.name}
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500 text-center">No clients found</div>
                  )}
                </div>
              )}
              {form.customerId && (
                <div className="mt-1 text-xs text-slate-500">
                  Selected: {customers.find(c => c.id === form.customerId)?.name}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Destination</label>
            <input className="shell-input-rect mt-1" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold uppercase text-slate-500">Start Date</label>
              <input type="date" className="shell-input-rect mt-1" value={form.travelStartDate} onChange={e => setForm({...form, travelStartDate: e.target.value})} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold uppercase text-slate-500">End Date</label>
              <input type="date" className="shell-input-rect mt-1" value={form.travelEndDate} onChange={e => setForm({...form, travelEndDate: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold uppercase text-slate-500">Adults</label>
              <input type="number" className="shell-input-rect mt-1" value={form.adults} onChange={e => setForm({...form, adults: parseInt(e.target.value)})} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold uppercase text-slate-500">Children</label>
              <input type="number" className="shell-input-rect mt-1" value={form.children} onChange={e => setForm({...form, children: parseInt(e.target.value)})} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Total Price (INR)</label>
            <input type="number" className="shell-input-rect mt-1" value={form.totalPrice} onChange={e => setForm({...form, totalPrice: parseFloat(e.target.value) || 0})} placeholder="0" />
          </div>
        </div>
      </div>

      {/* MIDDLE: Builder Canvas */}
      <div className="flex-1 bg-white p-6 overflow-y-auto relative">
        <div className="max-w-2xl mx-auto pb-32">
          
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Itinerary Builder</h1>
            <button onClick={addDay} className="shell-button-secondary">
              <PlusIcon className="w-4 h-4" /> Add Day
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={form.days} strategy={verticalListSortingStrategy}>
              {form.days.map((day, ix) => (
                <SortableDay key={day.id} day={day} index={ix} updateDay={updateDay} removeDay={removeDay} />
              ))}
            </SortableContext>
          </DndContext>

          {form.days.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl">
              <p className="text-slate-400 font-medium">Start planning the perfect trip.</p>
              <button onClick={addDay} className="mt-4 shell-button-primary"><PlusIcon className="w-4 h-4"/> Add Day 1</button>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT PANEL: Costing & Actions */}
      <div className="w-full lg:w-72 bg-slate-50 border-l border-slate-200 p-6 flex-shrink-0 flex flex-col justify-between overflow-y-auto z-10">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Financials</h2>
          
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#2d2d2d] shadow-lg">
              <p className="text-xs font-bold uppercase text-[#ebebeb] mb-1">Total Price</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(form.totalPrice * 100)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-6">
          <button onClick={handleExportPDF} className="shell-button-secondary w-full text-center justify-center">
            <DocumentArrowDownIcon className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="shell-button-primary w-full text-center justify-center">
            {saveMutation.isPending ? 'Saving...' : 'Save Itinerary'}
          </button>
        </div>
      </div>

      {/* HIDDEN PRINTABLE VIEW */}
      <div className="hidden">
        <div ref={pdfRef} className="bg-white text-black p-10 w-[800px]">
          <h1 className="text-4xl font-bold text-[#2d2d2d] mb-4">{form.name || 'Itinerary Proposal'}</h1>
          <p className="text-lg text-slate-600 mb-8">{form.destination}</p>
          <div className="mb-8 grid grid-cols-2 gap-4">
            <div><strong className="text-slate-500">Guests:</strong> {form.adults} Adults, {form.children} Children</div>
            <div><strong className="text-slate-500">Dates:</strong> {form.travelStartDate} to {form.travelEndDate}</div>
          </div>
          
          <div className="space-y-8">
            {form.days.map((d, i) => (
              <div key={i} className="border-l-4 border-[#2d2d2d] pl-4">
                <h3 className="text-xl font-bold">Day {i+1}: {d.title}</h3>
                <p className="text-slate-600 mt-2">{d.description}</p>
                {d.hotels?.length > 0 && <p className="mt-2 text-sm"><strong>Hotel:</strong> {d.hotels.map(h => h.name).join(', ')}</p>}
                {d.activities?.length > 0 && <p className="text-sm"><strong>Activities:</strong> {d.activities.map(h => h.name).join(', ')}</p>}
                {d.transports?.length > 0 && <p className="text-sm"><strong>Transport:</strong> {d.transports.map(h => h.name).join(', ')}</p>}
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-slate-200">
            <h3 className="text-2xl font-bold mb-4">Pricing</h3>
            <p className="text-3xl font-bold text-[#2d2d2d]">{formatCurrency(totals.price * 100)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
