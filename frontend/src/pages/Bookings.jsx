import { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '../api/bookingsApi';
import client from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';

const EMPTY_BOOKING_FORM = {
  customerId: '',
  packageId: '',
  itineraryId: '',
  totalAmount: '',
  advanceAmount: '',
  travelDate: '',
  returnDate: '',
  travellers: '2',
  notes: '',
};

function getListPayload(response) {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default function Bookings() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_BOOKING_FORM);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list({}),
  });
  const bookings = getListPayload(bookingsData);

  const { data: customersResponse } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.get('/customers').then(r => r.data),
  });
  const customers = getListPayload(customersResponse);

  const { data: packagesResponse } = useQuery({
    queryKey: ['packages'],
    queryFn: () => client.get('/packages').then(r => r.data),
  });
  const packages = getListPayload(packagesResponse);

  const { data: itinerariesResponse } = useQuery({
    queryKey: ['itineraries'],
    queryFn: () => client.get('/itineraries').then(r => r.data),
  });
  const itineraries = getListPayload(itinerariesResponse);

  const createBooking = useMutation({
    mutationFn: bookingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setIsCreateOpen(false);
      setForm(EMPTY_BOOKING_FORM);
    }
  });

  async function handleCreate(e) {
    e.preventDefault();
    await createBooking.mutateAsync({
      customerId: form.customerId,
      packageId: form.packageId || undefined,
      itineraryId: form.itineraryId || undefined,
      totalAmount: Number(form.totalAmount) * 100,
      advanceAmount: Number(form.advanceAmount) * 100,
      travelDate: form.travelDate,
      returnDate: form.returnDate || undefined,
      travellers: Number(form.travellers),
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <div className="w-full space-y-4">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Bookings</h1>
          <p className="text-sm text-slate-500">Manage all customer bookings and trip schedules.</p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="shell-button-primary inline-flex w-full items-center justify-center gap-2 md:w-auto"
        >
          <PlusIcon className="h-4 w-4" />
          Create Booking
        </button>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Ref', 'Customer', 'Trip', 'Travel Date', 'Status'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 5 }).map((_, cell) => (
                      <td key={cell} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-sm text-slate-500">No bookings found.</td></tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-4 py-4 text-sm font-semibold">{booking.bookingRef}</td>
                    <td className="px-4 py-4 text-sm">{booking.customer?.name}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{booking.package?.name || 'Custom'}</td>
                    <td className="px-4 py-4 text-sm">{formatDate(booking.travelDate)}</td>
                    <td className="px-4 py-4">
                      <span className="badge bg-[#ebebeb] text-[#2d2d2d]">{booking.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[18px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">New Booking</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Create Booking</h2>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="rounded-[10px] p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer">
                  <select required value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})} className="shell-input-rect">
                    <option value="">Select customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                </Field>
                <Field label="Package">
                  <select value={form.packageId} onChange={e => setForm({...form, packageId: e.target.value})} className="shell-input-rect">
                    <option value="">None / Custom</option>
                    {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Itinerary">
                  <select value={form.itineraryId} onChange={e => setForm({...form, itineraryId: e.target.value})} className="shell-input-rect">
                    <option value="">None / Create Later</option>
                    {itineraries.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                  </select>
                </Field>
                <Field label="Travelers">
                  <input type="number" min="1" required value={form.travellers} onChange={e => setForm({...form, travellers: e.target.value})} className="shell-input-rect" />
                </Field>
                <Field label="Travel Date">
                  <input type="date" required value={form.travelDate} onChange={e => setForm({...form, travelDate: e.target.value})} className="shell-input-rect" />
                </Field>
                <Field label="Return Date">
                  <input type="date" value={form.returnDate} onChange={e => setForm({...form, returnDate: e.target.value})} className="shell-input-rect" />
                </Field>
                <Field label="Total Amount (₹)">
                  <input type="number" min="0" required value={form.totalAmount} onChange={e => setForm({...form, totalAmount: e.target.value})} className="shell-input-rect" />
                </Field>
                <Field label="Advance Amount (₹)">
                  <input type="number" min="0" required value={form.advanceAmount} onChange={e => setForm({...form, advanceAmount: e.target.value})} className="shell-input-rect" />
                </Field>
              </div>

              <Field label="Notes">
                <textarea rows="3" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="shell-input-rect rounded-[14px]" />
              </Field>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="shell-button-secondary">Cancel</button>
                <button type="submit" disabled={createBooking.isPending} className="shell-button-primary">
                  {createBooking.isPending ? 'Saving...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
