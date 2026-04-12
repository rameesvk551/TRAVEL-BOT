// FILE: /frontend/src/components/SendPaymentModal.jsx

import { useState } from 'react';
import { paymentsApi } from '../api/paymentsApi';
import { formatCurrency } from '../utils/formatters';
import { XMarkIcon, CreditCardIcon } from '@heroicons/react/24/outline';

export default function SendPaymentModal({ booking, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const balanceDue = booking.totalAmount - booking.advancePaid;

  const handleSend = async () => {
    setLoading(true);
    setError('');
    try {
      await paymentsApi.requestPayment(booking.id);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create payment link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-md animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-surface-400 hover:text-white">
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
            <CreditCardIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Send Payment Link</h3>
            <p className="text-sm text-surface-400">Booking #{booking.bookingRef}</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-surface-400">Total Amount</span>
            <span className="text-white font-medium">{formatCurrency(booking.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-surface-400">Advance Paid</span>
            <span className="text-green-400">{formatCurrency(booking.advancePaid)}</span>
          </div>
          <div className="border-t border-surface-700/50 pt-3 flex justify-between text-sm">
            <span className="text-surface-300 font-medium">Amount Due</span>
            <span className="text-white font-bold text-lg">{formatCurrency(balanceDue)}</span>
          </div>
        </div>

        <p className="text-xs text-surface-400 mb-4">
          A Razorpay payment link will be created and sent to the customer via WhatsApp.
          The link expires in 24 hours.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSend}
            disabled={loading || balanceDue <= 0}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? 'Sending...' : `Send ${formatCurrency(balanceDue)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
