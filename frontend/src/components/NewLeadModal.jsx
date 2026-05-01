import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCreateLead } from '../hooks/useLeads';

export default function NewLeadModal({ isOpen, onClose, agents }) {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    destination: '',
    source: 'manual',
    assignedAgentId: '',
    budgetPerPerson: '',
    tagsText: '',
  });

  const createLead = useCreateLead();

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    createLead.mutate(
      {
        ...formData,
        budgetPerPerson: formData.budgetPerPerson ? Number(formData.budgetPerPerson) * 100 : undefined,
        assignedAgentId: formData.assignedAgentId || undefined,
        tags: formData.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          setFormData({
            customerName: '',
            customerPhone: '',
            customerEmail: '',
            destination: '',
            source: 'manual',
            assignedAgentId: '',
            budgetPerPerson: '',
            tagsText: '',
          });
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Create New Lead</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Phone</label>
            <input
              type="text"
              required
              className="shell-input-rect w-full h-11 bg-neutral-50 px-3"
              placeholder="+91..."
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Name</label>
            <input
              type="text"
              className="shell-input-rect w-full h-11 bg-neutral-50 px-3"
              placeholder="Customer Name"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Email</label>
            <input
              type="email"
              className="shell-input-rect w-full h-11 bg-neutral-50 px-3"
              placeholder="customer@example.com"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Destination</label>
            <input
              type="text"
              className="shell-input-rect w-full h-11 bg-neutral-50 px-3"
              placeholder="e.g. Kerala, Bali"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Source</label>
              <select
                className="shell-input-rect w-full h-11 bg-neutral-50 px-2"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="manual">Manual</option>
                <option value="whatsapp_organic">WhatsApp Organic</option>
                <option value="facebook_ad">Facebook Ad</option>
                <option value="instagram_ad">Instagram Ad</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Assign To</label>
              <select
                className="shell-input-rect w-full h-11 bg-neutral-50 px-2"
                value={formData.assignedAgentId}
                onChange={(e) => setFormData({ ...formData, assignedAgentId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Tags</label>
            <input
              type="text"
              className="shell-input-rect w-full h-11 bg-neutral-50 px-3"
              placeholder="urgent, honeymoon, high budget"
              value={formData.tagsText}
              onChange={(e) => setFormData({ ...formData, tagsText: e.target.value })}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-neutral-600 transition-colors hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLead.isPending}
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-black disabled:opacity-50"
            >
              {createLead.isPending ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
