import { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '../api/bookingsApi';
import client from '../api/client';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getStatusTone } from '../components/uiHelpers';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';

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

function getSinglePayload(response) {
  return response?.data?.data || response?.data || response || null;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

function DetailItem({ label, value, children }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-slate-100 bg-slate-50/70 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">
        {children || value || <span className="font-normal text-slate-400">-</span>}
      </div>
    </div>
  );
}

export default function Bookings() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [form, setForm] = useState(EMPTY_BOOKING_FORM);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list({}),
  });
  const bookings = getListPayload(bookingsData);

  const { data: bookingDetailsResponse, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['booking', selectedBookingId],
    queryFn: () => bookingsApi.getById(selectedBookingId),
    enabled: Boolean(selectedBookingId),
  });
  const selectedBooking = getSinglePayload(bookingDetailsResponse);

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
      <section className="flex flex-col gap-4 border-b border-neutral-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="page-heading">Bookings</h1>
          <p className="page-subtext">Manage all customer bookings and trip schedules.</p>
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

      <section className="mobile-card-list">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="mobile-record-card">
              <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-100" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((__, cell) => (
                  <div key={cell} className="h-10 animate-pulse rounded bg-neutral-100" />
                ))}
              </div>
            </div>
          ))
        ) : bookings.length === 0 ? (
          <div className="mobile-record-card text-sm text-neutral-400">No bookings found.</div>
        ) : (
          bookings.map((booking) => (
            <MobileRecordCard
              key={booking.id}
              title={booking.bookingRef}
              subtitle={booking.customer?.name || 'Traveler'}
              badge={<span className={`badge ${getStatusTone(booking.status)}`}>{booking.status}</span>}
              onClick={() => setSelectedBookingId(booking.id)}
            >
              <MobileField label="Trip" value={booking.package?.name || 'Custom'} />
              <MobileField label="Travel" value={formatDate(booking.travelDate)} />
              <MobileField label="Total" value={formatCurrency(booking.totalAmount)} />
              <MobileField label="Advance" value={formatCurrency(booking.advancePaid)} />
            </MobileRecordCard>
          ))
        )}
      </section>

      <section className="data-table-wrapper desktop-table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="data-table-head">
                {['Ref', 'Customer', 'Trip', 'Travel Date', 'Status'].map((heading) => (
                  <th key={heading} className="data-table-th">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-b border-neutral-100">
                    {Array.from({ length: 5 }).map((_, cell) => (
                      <td key={cell} className="data-table-td"><div className="h-4 animate-pulse rounded bg-neutral-100" /></td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-sm text-neutral-400">No bookings found.</td></tr>
              ) : (
                bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="data-table-row cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedBookingId(booking.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedBookingId(booking.id);
                      }
                    }}
                  >
                    <td className="data-table-td font-semibold text-neutral-900">{booking.bookingRef}</td>
                    <td className="data-table-td text-neutral-700">{booking.customer?.name}</td>
                    <td className="data-table-td text-neutral-500">{booking.package?.name || 'Custom'}</td>
                    <td className="data-table-td text-neutral-600">{formatDate(booking.travelDate)}</td>
                    <td className="data-table-td">
                      <span className={`badge ${getStatusTone(booking.status)}`}>{booking.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[18px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] sm:max-w-2xl sm:rounded-[18px] sm:p-6">
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

      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[18px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] sm:max-w-3xl sm:rounded-[18px] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Booking Details</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {selectedBooking?.bookingRef || 'Loading booking'}
                </h2>
              </div>
              <button onClick={() => setSelectedBookingId(null)} className="rounded-[10px] p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {isDetailsLoading ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-[12px] bg-slate-100" />
                ))}
              </div>
            ) : selectedBooking ? (
              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`badge ${getStatusTone(selectedBooking.status)}`}>{selectedBooking.status}</span>
                  <span className="text-sm text-slate-500">{selectedBooking.package?.name || 'Custom itinerary'}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Customer" value={selectedBooking.customer?.name} />
                  <DetailItem label="Phone" value={selectedBooking.customer?.phone} />
                  <DetailItem label="Travellers" value={selectedBooking.travellers} />
                  <DetailItem label="Travel Date" value={formatDate(selectedBooking.travelDate)} />
                  <DetailItem label="Return Date" value={formatDate(selectedBooking.returnDate)} />
                  <DetailItem label="Total Amount" value={formatCurrency(selectedBooking.totalAmount)} />
                  <DetailItem label="Advance Paid" value={formatCurrency(selectedBooking.advancePaid)} />
                  <DetailItem label="Balance Due" value={formatCurrency(selectedBooking.balanceDue ?? (selectedBooking.totalAmount - selectedBooking.advancePaid))} />
                  <DetailItem label="Lead Status" value={selectedBooking.lead?.status} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-[14px] border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-950">Payments</h3>
                    <div className="mt-3 space-y-3">
                      {(selectedBooking.payments || []).length === 0 ? (
                        <p className="text-sm text-slate-400">No payments recorded.</p>
                      ) : (
                        selectedBooking.payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between gap-3 rounded-[10px] bg-slate-50 p-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{payment.type || 'Payment'}</p>
                              <p className="text-xs text-slate-400">{formatDate(payment.paidAt || payment.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-950">{formatCurrency(payment.amount)}</p>
                              <p className="text-xs font-semibold uppercase text-slate-400">{payment.status}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded-[14px] border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-950">Notes</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {selectedBooking.notes || 'No notes added.'}
                    </p>
                  </section>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-400">Booking details could not be loaded.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
