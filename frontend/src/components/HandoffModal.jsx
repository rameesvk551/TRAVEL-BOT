// FILE: /frontend/src/components/HandoffModal.jsx

import { XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

export default function HandoffModal({ customerName, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-sm animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-surface-400 hover:text-white">
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <ArrowsRightLeftIcon className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Transfer Conversation</h3>
          <p className="text-sm text-surface-400 mb-6">
            Are you sure you want to transfer the conversation with <strong className="text-white">{customerName}</strong> back to the bot?
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={onConfirm} className="btn-primary flex-1 bg-amber-600 hover:bg-amber-500">Transfer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
