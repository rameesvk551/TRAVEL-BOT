import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import api from '../api/client';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      const res = await api.get('/quotations');
      setQuotations(res.data.data);
    } catch (err) {
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const [busyId, setBusyId] = useState(null);

  const downloadPdf = async (e, q) => {
    e.stopPropagation();
    setBusyId(q.id);
    try {
      const res = await api.get(`/quotations/${q.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error('Failed to generate PDF');
    } finally {
      setBusyId(null);
    }
  };

  const sendWhatsApp = async (e, q) => {
    e.stopPropagation();
    if (!window.confirm('Send this quotation to the customer on WhatsApp?')) return;
    setBusyId(q.id);
    try {
      await api.post(`/quotations/${q.id}/send-whatsapp`);
      toast.success('Quotation sent on WhatsApp');
      fetchQuotations();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setBusyId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600">Draft</span>;
      case 'SENT': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Sent</span>;
      case 'ACCEPTED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Accepted</span>;
      case 'REJECTED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Rejected</span>;
      default: return <span className="px-2 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Quotations</h2>
          <p className="text-sm text-neutral-500">Manage your generated estimates and quotations.</p>
        </div>
        <Link
          to="/quotations/new"
          className="inline-flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Quotation
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading quotations...</div>
        ) : quotations.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <DocumentTextIcon className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No quotations found</h3>
            <p className="text-neutral-500 max-w-sm mb-6">Create your first quotation to send a styled estimate to a customer.</p>
            <Link
              to="/quotations/new"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg"
            >
              Create Quotation
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Number</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Lead/Customer</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-neutral-50 transition-colors cursor-pointer" onClick={() => navigate(`/quotations/${q.id}/edit`)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                      {q.quotationNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                      {q.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-neutral-900">{q.customer?.name || q.lead?.customer?.name || 'N/A'}</div>
                      <div className="text-xs text-neutral-500">Items: {q.items?.length || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-neutral-900">
                      ₹{formatCurrency(q.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(q.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={(e) => downloadPdf(e, q)} disabled={busyId === q.id} className="text-neutral-600 hover:text-neutral-900">PDF</button>
                        <button onClick={(e) => sendWhatsApp(e, q)} disabled={busyId === q.id} className="text-emerald-600 hover:text-emerald-800">{busyId === q.id ? '…' : 'Send'}</button>
                        <span className="text-blue-600 hover:text-blue-900">Edit</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
