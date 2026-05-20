import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ClipboardDocumentIcon, KeyIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BriefcaseBusiness, Building2, CheckCircle2, Hotel, IdCard, Save } from 'lucide-react';
import { agentsApi } from '../api/agentsApi';
import { serviceRoutingApi } from '../api/serviceRoutingApi';
import { useAuthStore } from '../store/authStore';
import MobileRecordCard, { MobileField } from '../components/MobileRecordCard';

const ROUTING_INTENT_FALLBACK = [
  { key: 'properties', label: 'Properties' },
  { key: 'staycations', label: 'Staycations' },
  { key: 'packages', label: 'Packages' },
  { key: 'visa', label: 'Visa Services' },
];

const ROUTING_META = {
  properties: {
    icon: Building2,
    description: 'Property enquiries go to the selected specialist.',
    tone: 'border-sky-100 bg-sky-50 text-sky-700',
  },
  staycations: {
    icon: Hotel,
    description: 'Staycation requests route to the stay expert.',
    tone: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  },
  packages: {
    icon: BriefcaseBusiness,
    description: 'Package and trip planning leads are assigned here.',
    tone: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  },
  visa: {
    icon: IdCard,
    description: 'Visa and ticketing leads reach this agent.',
    tone: 'border-amber-100 bg-amber-50 text-amber-700',
  },
};

export default function Agents() {
  const qc = useQueryClient();
  const agent = useAuthStore((state) => state.agent);
  const canManageAgents = agent?.role === 'ADMIN' || agent?.permissions?.includes('USERS_MANAGE');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'AGENT' });
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [routingDraft, setRoutingDraft] = useState({});
  const [activeTab, setActiveTab] = useState('users');

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(),
    enabled: canManageAgents,
  });

  const { data: routingResponse, isLoading: isRoutingLoading } = useQuery({
    queryKey: ['service-routing'],
    queryFn: () => serviceRoutingApi.get(),
    enabled: canManageAgents,
  });

  const createMutation = useMutation({
    mutationFn: (data) => agentsApi.create(data),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setShowCreateModal(false);
      setForm({ name: '', email: '', phone: '', role: 'AGENT' });
      setCreatedCredentials(response?.data || null);
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

  const routingMutation = useMutation({
    mutationFn: (rules) => serviceRoutingApi.replace(rules),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['service-routing'] });
      const nextDraft = {};
      (response?.data?.rules || []).forEach((rule) => {
        if (!nextDraft[rule.intentKey]) nextDraft[rule.intentKey] = rule.agentId;
      });
      setRoutingDraft(nextDraft);
    },
  });

  const agents = data?.data || [];
  const routingIntents = routingResponse?.data?.intents || ROUTING_INTENT_FALLBACK;

  useEffect(() => {
    if (!routingResponse?.data?.rules) return;
    const nextDraft = {};
    routingResponse.data.rules.forEach((rule) => {
      if (!nextDraft[rule.intentKey]) nextDraft[rule.intentKey] = rule.agentId;
    });
    setRoutingDraft(nextDraft);
  }, [routingResponse]);

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

  const saveRouting = () => {
    const rules = Object.entries(routingDraft)
      .filter(([, agentId]) => agentId)
      .map(([intentKey, agentId]) => ({
        intentKey,
        agentId,
        priority: 100,
        isActive: true,
      }));
    routingMutation.mutate(rules);
  };

  const findAgentById = (agentId) => agents.find((agentOption) => agentOption.id === agentId);

  return (
    <div className="w-full space-y-4">
      {canManageAgents && activeTab === 'users' ? (
        <>
          {/* Mobile Action Bar */}
          <div className="mb-3 rounded-2xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-50 p-2.5 shadow-[0_4px_18px_-14px_rgba(0,0,0,0.35)] md:hidden">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="shell-button-primary h-10 w-full justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold shadow-sm hover:bg-black"
              >
                <PlusIcon className="h-4 w-4" />
                Add User
              </button>
            </div>
          </div>
          {/* Desktop Action Bar */}
          <section className="hidden md:flex justify-end border-b border-neutral-200 pb-4">
            <button type="button" onClick={() => setShowCreateModal(true)} className="shell-button-primary">
              <PlusIcon className="h-4 w-4" />
              Add User
            </button>
          </section>
        </>
      ) : null}

      {!canManageAgents ? (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Only ADMIN users can manage agents.
        </div>
      ) : null}

      {canManageAgents ? (
        <div className="inline-flex w-full gap-1 rounded-[var(--radius-md)] border border-neutral-200 bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:w-fit">
          {[
            { id: 'users', label: 'Team Members' },
            { id: 'routing', label: 'Service Routing' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 flex-1 rounded-[10px] px-4 text-sm font-bold transition sm:flex-none ${
                activeTab === tab.id
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {canManageAgents && activeTab === 'routing' ? (
        <section className="shell-panel overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-neutral-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">Assignment Rules</p>
              <h2 className="mt-1 text-lg font-extrabold text-neutral-950">WhatsApp Service Routing</h2>
            </div>
            <button
              type="button"
              onClick={saveRouting}
              disabled={routingMutation.isPending || isRoutingLoading}
              className="shell-button-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {routingMutation.isPending ? 'Saving' : 'Save Routing'}
            </button>
          </div>

          <div className="divide-y divide-neutral-100">
            {routingIntents.map((intent) => {
              const meta = ROUTING_META[intent.key] || ROUTING_META.packages;
              const Icon = meta.icon;
              const assignedAgent = findAgentById(routingDraft[intent.key]);

              return (
                <div key={intent.key} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_220px_360px] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border ${meta.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-extrabold text-neutral-950">{intent.label}</h3>
                        <span className="badge bg-neutral-100 text-neutral-500">{intent.key}</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">{meta.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className={assignedAgent ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-neutral-300'} />
                    <span className={assignedAgent ? 'font-semibold text-neutral-800' : 'font-semibold text-neutral-500'}>
                      {assignedAgent ? assignedAgent.name : 'Least busy'}
                    </span>
                  </div>

                  <label className="block">
                    <span className="sr-only">Agent for {intent.label}</span>
                    <select
                      value={routingDraft[intent.key] || ''}
                      onChange={(e) => setRoutingDraft((current) => ({ ...current, [intent.key]: e.target.value }))}
                      className="shell-input-rect bg-white"
                    >
                      <option value="">Least busy agent</option>
                      {agents.map((agentOption) => (
                        <option key={agentOption.id} value={agentOption.id}>
                          {agentOption.name}{agentOption.phone ? ` - ${agentOption.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {createdCredentials?.temporaryPassword ? (
        <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-bold">
                <KeyIcon className="h-4 w-4" />
                User login created
              </div>
              <p className="mt-1 text-emerald-800">
                Email: <span className="font-bold">{createdCredentials.agent?.email}</span>
              </p>
              <p className="mt-1 text-emerald-800">
                Temporary password: <span className="font-mono font-bold">{createdCredentials.temporaryPassword}</span>
              </p>
              <p className="mt-2 text-xs text-emerald-700">
                {createdCredentials.welcomeEmailSent
                  ? 'A welcome email was sent with these login details.'
                  : `Email was not sent${createdCredentials.emailWarning ? `: ${createdCredentials.emailWarning}` : ''}. Share this password with the user manually.`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(`Email: ${createdCredentials.agent?.email}\nTemporary password: ${createdCredentials.temporaryPassword}`)}
                className="shell-button-secondary py-2 text-xs"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="shell-button-secondary py-2 text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'users' ? (
      <>
      <div className="mobile-card-list">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="mobile-record-card">
              <div className="h-5 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((__, cell) => <div key={cell} className="h-10 animate-pulse rounded bg-slate-100" />)}
              </div>
            </div>
          ))
        ) : agents.length === 0 ? (
          <div className="mobile-record-card text-sm text-slate-500">No agents yet.</div>
        ) : (
          agents.map((agent) => (
            <MobileRecordCard
              key={agent.id}
              title={agent.name}
              subtitle={agent.email}
              badge={<span className={`badge ${agent.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{agent.isOnline ? 'Online' : 'Offline'}</span>}
              actions={canManageAgents ? (
                <>
                  <button type="button" onClick={() => openEdit(agent)} className="shell-button-secondary flex-1 py-2 text-xs">
                    <PencilIcon className="h-4 w-4" /> Edit
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(agent.id)} className="shell-button-secondary flex-1 py-2 text-xs text-rose-600">
                    <TrashIcon className="h-4 w-4" /> Deactivate
                  </button>
                </>
              ) : null}
            >
              <MobileField label="Phone" value={agent.phone || '-'} />
              <MobileField label="Role" value={agent.role} />
            </MobileRecordCard>
          ))
        )}
      </div>

      <div className="data-table-wrapper desktop-table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="data-table-head">
                {['Name', 'Email', 'Phone', 'Role', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="data-table-th">
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
                    <td className="data-table-td">
                      <span className={`badge ${agent.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
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
      </>
      ) : null}

      {(showCreateModal || editingAgent) ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] border border-white/80 bg-white p-5 shadow-[0_34px_90px_-50px_rgba(15,23,42,0.55)] sm:max-w-md sm:rounded-[32px] sm:p-6">
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
