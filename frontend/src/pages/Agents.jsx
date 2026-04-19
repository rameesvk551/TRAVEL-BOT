import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { agentsApi } from '../api/agentsApi';
import { useAuthStore } from '../store/authStore';

export default function Agents() {
  const qc = useQueryClient();
  const agent = useAuthStore((state) => state.agent);
  const canManageAgents = agent?.role === 'ADMIN' || agent?.permissions?.includes('USERS_MANAGE');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'AGENT' });

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(),
    enabled: canManageAgents,
  });

  const createMutation = useMutation({
    mutationFn: (data) => agentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setShowCreateModal(false);
      setForm({ name: '', email: '', phone: '', role: 'AGENT' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => agentsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setEditingAgent(null);
      setForm({ name: '', email: '', phone: '', role: 'AGENT' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => agentsApi.update(id, { isActive: false }), // Assuming soft delete
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });

  const agents = data?.data || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (agent) => {
    setEditingAgent(agent);
    setForm({ name: agent.name, email: agent.email, phone: agent.phone || '', role: agent.role });
  };

  return (
    <div className="w-full space-y-4">
      <section className="flex items-end justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Users</h1>
          <p className="text-sm text-slate-500">Manage team members and their access levels.</p>
        </div>
        {canManageAgents ? (
          <button type="button" onClick={() => setShowCreateModal(true)} className="shell-button-primary">
            <PlusIcon className="h-4 w-4" />
            Add User
          </button>
        ) : null}
      </section>

      {!canManageAgents ? (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Only ADMIN users can manage agents.
        </div>
      ) : null}

      <div className="rounded-[12px] border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Name', 'Email', 'Phone', 'Role', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 6 }).map((_, cell) => (
                      <td key={cell} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-sm text-slate-500">No agents yet.</td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id}>
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">{agent.name}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{agent.email}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{agent.phone || '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{agent.role}</td>
                    <td className="px-4 py-4">
                      <span className={`badge ${agent.isOnline ? 'bg-[#ebebeb] text-[#2d2d2d]' : 'bg-slate-100 text-slate-600'}`}>
                        {agent.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {canManageAgents ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openEdit(agent)} className="text-slate-400 hover:text-slate-600">
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => deleteMutation.mutate(agent.id)} className="text-slate-400 hover:text-slate-600">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showCreateModal || editingAgent) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] border border-white/80 bg-white p-6 shadow-[0_34px_90px_-50px_rgba(15,23,42,0.55)]">
            <h3 className="text-xl font-extrabold text-slate-950">{editingAgent ? 'Edit User' : 'Add User'}</h3>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-[20px] border border-slate-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-[20px] border border-slate-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-[20px] border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 w-full rounded-[20px] border border-slate-300 px-3 py-2"
                >
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 rounded-[20px] bg-[#2d2d2d] px-4 py-2 text-white">
                  {editingAgent ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAgent(null);
                    setForm({ name: '', email: '', phone: '', role: 'AGENT' });
                  }}
                  className="flex-1 rounded-[20px] border border-slate-300 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}