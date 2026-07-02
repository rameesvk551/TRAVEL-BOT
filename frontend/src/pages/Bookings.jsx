import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownTrayIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { bookingsApi } from '../api/bookingsApi';
import { packagesApi } from '../api/packagesApi';
import { servicesApi } from '../api/servicesApi';
import { useCustomers } from '../api/customersApi';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getStatusTone } from '../components/uiHelpers';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';
import { useIndustry } from '../hooks/useIndustry';



function getListPayload(response) {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
}

function getSinglePayload(response) {
  return response?.data?.data || response?.data || response || null;
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
  const navigate = useNavigate();
  const { t } = useIndustry();
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState(null);

  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterPackage, setFilterPackage] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterItemType, setFilterItemType] = useState('');

  const { data: customersData } = useCustomers({ pageSize: 1000 });
  const customers = getListPayload(customersData);

  const { data: packagesData } = useQuery({
    queryKey: ['packagesList'],
    queryFn: () => packagesApi.list({ pageSize: 1000 }),
  });
  const packages = getListPayload(packagesData);

  const { data: servicesData } = useQuery({
    queryKey: ['servicesList'],
    queryFn: () => servicesApi.list({ pageSize: 1000 }),
  });
  const services = getListPayload(servicesData);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['bookings', { filterCustomer, filterPackage, filterService, filterItemType }],
    queryFn: () => bookingsApi.list({
      customerId: filterCustomer || undefined,
      packageId: filterPackage || undefined,
      serviceId: filterService || undefined,
      itemType: filterItemType || undefined,
    }),
  });
  const bookings = getListPayload(bookingsData);
  const stats = bookingsData?.data?.stats;

  const { data: bookingDetailsResponse, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['booking', selectedBookingId],
    queryFn: () => bookingsApi.getById(selectedBookingId),
    enabled: Boolean(selectedBookingId),
  });
  const selectedBooking = getSinglePayload(bookingDetailsResponse);



  const getBookingItemName = (b) => {
    if (!b) return '';
    if (b.itemType === 'PROPERTY') return b.property?.name || 'Property';
    if (b.itemType === 'CRUISE') return b.cruise?.name || 'Cruise';
    if (b.itemType === 'VISA') return b.visa ? `${b.visa.country} Visa` : 'Visa';
    if (b.itemType === 'SERVICE') return b.service?.name || 'Service';
    if (b.itemType === 'CUSTOM') return b.customItemName || 'Custom';
    return b.package?.name || 'Package';
  };

  const downloadInvoice = async (booking) => {
    if (!booking?.id) return;
    setDownloadingInvoiceId(booking.id);
    try {
      const response = await bookingsApi.downloadInvoice(booking.id);
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const fallbackName = `${booking.bookingRef || 'booking'}-invoice.pdf`;
      const filename = match?.[1] || fallbackName;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Invoice PDF downloaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to download invoice');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
        <h1 className="text-2xl font-semibold text-slate-900">{t('bookings', 'Bookings')}</h1>
        <button onClick={() => navigate('/bookings/new')} className="shell-button-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          <span>New Booking</span>
        </button>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Total Bookings" value={stats.totalBookings} />
          <DetailItem label="Total Revenue" value={formatCurrency(stats.totalRevenue)} />
          <DetailItem label="Advance Paid" value={formatCurrency(stats.totalAdvancePaid)} />
          <DetailItem label="Balance Due" value={formatCurrency(stats.totalBalanceDue)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 bg-white p-4 rounded-[12px] shadow-sm border border-neutral-100">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
          <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} className="w-full rounded-lg border-neutral-200 text-sm py-2">
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Item Type</label>
          <select value={filterItemType} onChange={(e) => setFilterItemType(e.target.value)} className="w-full rounded-lg border-neutral-200 text-sm py-2">
            <option value="">All Types</option>
            <option value="PACKAGE">Package</option>
            <option value="SERVICE">Service</option>
            <option value="EXT">Custom (Ext)</option>
            <option value="CRUISE">Cruise</option>
            <option value="VISA">Visa</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Package</label>
          <select value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)} className="w-full rounded-lg border-neutral-200 text-sm py-2" disabled={filterItemType && filterItemType !== 'PACKAGE'}>
            <option value="">All Packages</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Service</label>
          <select value={filterService} onChange={(e) => setFilterService(e.target.value)} className="w-full rounded-lg border-neutral-200 text-sm py-2" disabled={filterItemType && filterItemType !== 'SERVICE'}>
            <option value="">All Services</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

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
              <MobileField label="Item" value={getBookingItemName(booking)} />
              <MobileField label="Type" value={<span className="text-xs px-2 py-1 bg-slate-100 rounded-md font-medium text-slate-600">{booking.itemType}</span>} />
              <MobileField label="Travel" value={formatDate(booking.travelDate) || '-'} />
              <MobileField label="Total" value={formatCurrency(booking.totalAmount)} />
            </MobileRecordCard>
          ))
        )}
      </section>

      <section className="data-table-wrapper desktop-table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="data-table-head">
                {['Ref', 'Customer', 'Type', 'Item', 'Travel Date', 'Amount', 'Status'].map((heading) => (
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
                    {Array.from({ length: 7 }).map((_, cell) => (
                      <td key={cell} className="data-table-td"><div className="h-4 animate-pulse rounded bg-neutral-100" /></td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-sm text-neutral-400">No bookings found.</td></tr>
              ) : (
                bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="data-table-row cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedBookingId(booking.id)}
                  >
                    <td className="data-table-td font-semibold text-neutral-900">{booking.bookingRef}</td>
                    <td className="data-table-td text-neutral-700">{booking.customer?.name}</td>
                    <td className="data-table-td"><span className="text-xs px-2 py-1 bg-slate-100 rounded-md font-medium text-slate-600">{booking.itemType}</span></td>
                    <td className="data-table-td text-neutral-500">{getBookingItemName(booking)}</td>
                    <td className="data-table-td text-neutral-600">{formatDate(booking.travelDate) || '-'}</td>
                    <td className="data-table-td text-neutral-900 font-medium">{formatCurrency(booking.totalAmount)}</td>
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

      {/* Detail Modal */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-full w-full flex-col overflow-y-auto bg-white p-4 sm:p-8">
            <div className="mx-auto w-full max-w-5xl">
              <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Booking Details</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {selectedBooking?.bookingRef || 'Loading booking'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {selectedBooking && (
                  <button
                    type="button"
                    onClick={() => downloadInvoice(selectedBooking)}
                    disabled={downloadingInvoiceId === selectedBooking.id}
                    className="shell-button-secondary flex items-center gap-2"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    <span>{downloadingInvoiceId === selectedBooking.id ? 'Preparing...' : 'Invoice PDF'}</span>
                  </button>
                )}
                <button onClick={() => setSelectedBookingId(null)} className="rounded-[10px] p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
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
                  <span className="text-sm font-semibold px-2 py-1 bg-slate-100 rounded-md text-slate-600">{selectedBooking.itemType}</span>
                  <span className="text-sm text-slate-600">{getBookingItemName(selectedBooking)}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Customer" value={selectedBooking.customer?.name} />
                  <DetailItem label="Phone" value={selectedBooking.customer?.phone} />
                  <DetailItem label="Payment Terms" value={selectedBooking.paymentMode} />
                  <DetailItem label="Travellers" value={selectedBooking.travellers || '-'} />
                  <DetailItem label="Travel Date" value={formatDate(selectedBooking.travelDate)} />
                  <DetailItem label="Base Price" value={formatCurrency(selectedBooking.basePrice || 0)} />
                  <DetailItem label="Total Amount" value={formatCurrency(selectedBooking.totalAmount)} />
                  <DetailItem label="Advance Paid" value={formatCurrency(selectedBooking.advancePaid)} />
                  <DetailItem label="Balance Due" value={formatCurrency(selectedBooking.balanceDue ?? (selectedBooking.totalAmount - selectedBooking.advancePaid))} />
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
        </div>
      )}
    </div>
  );
}
