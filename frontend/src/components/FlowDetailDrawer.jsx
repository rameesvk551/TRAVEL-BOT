import React, { useEffect, useState } from 'react';
import { Eye, RefreshCw, Save, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateFlow, usePublishFlow, useUpdateFlow } from '../hooks/useFlows';

const STARTER_JSON = {
  PACKAGE: {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: { PACKAGE_SELECTOR: [] },
    screens: [{ id: 'PACKAGE_SELECTOR', title: 'Choose Package', terminal: true, data: {}, layout: { type: 'SingleColumnLayout', children: [] } }],
  },
  PROPERTY: {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: { PROPERTY_SELECTOR: [] },
    screens: [{ id: 'PROPERTY_SELECTOR', title: 'Choose Property', terminal: true, data: {}, layout: { type: 'SingleColumnLayout', children: [] } }],
  },
  CUSTOM_TRIP: {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: { CUSTOM_TRIP_FORM: [] },
    screens: [{ id: 'CUSTOM_TRIP_FORM', title: 'Custom Trip', terminal: true, data: {}, layout: { type: 'SingleColumnLayout', children: [] } }],
  },
  REVIEW: {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: { REVIEW_FORM: [] },
    screens: [{ id: 'REVIEW_FORM', title: 'Trip Review', terminal: true, data: {}, layout: { type: 'SingleColumnLayout', children: [] } }],
  },
  GENERIC: {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {},
    screens: [],
  },
};

export default function FlowDetailDrawer({ isOpen, onClose, flow }) {
  const createMutation = useCreateFlow();
  const updateMutation = useUpdateFlow();
  const publishMutation = usePublishFlow();
  const [formData, setFormData] = useState({
    name: '',
    flowType: 'PACKAGE',
    endpointUri: 'https://travelbot.wayon.in/api/whatsapp/flow',
    categories: ['OTHER'],
    firstScreenId: '',
    jsonDefinition: JSON.stringify(STARTER_JSON.PACKAGE, null, 2),
  });
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (flow) {
      setFormData({
        name: flow.name || '',
        flowType: flow.flowType || 'GENERIC',
        endpointUri: flow.endpointUri || 'https://travelbot.wayon.in/api/whatsapp/flow',
        categories: flow.categories || ['OTHER'],
        firstScreenId: flow.firstScreenId || '',
        jsonDefinition: JSON.stringify(flow.jsonDefinition || {}, null, 2),
      });
    } else {
      setFormData({
        name: '',
        flowType: 'PACKAGE',
        endpointUri: 'https://travelbot.wayon.in/api/whatsapp/flow',
        categories: ['OTHER'],
        firstScreenId: 'PACKAGE_SELECTOR',
        jsonDefinition: JSON.stringify(STARTER_JSON.PACKAGE, null, 2),
      });
    }
  }, [flow]);

  if (!isOpen) return null;

  const parsedJson = (() => {
    try {
      return JSON.parse(formData.jsonDefinition || '{}');
    } catch {
      return null;
    }
  })();

  const handleTypeChange = (value) => {
    setFormData((current) => ({
      ...current,
      flowType: value,
      firstScreenId: STARTER_JSON[value]?.screens?.[0]?.id || '',
      jsonDefinition: JSON.stringify(STARTER_JSON[value] || STARTER_JSON.GENERIC, null, 2),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Flow name is required');
      return;
    }
    if (!parsedJson) {
      toast.error('Flow JSON must be valid');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      flowType: formData.flowType,
      endpointUri: formData.endpointUri.trim(),
      firstScreenId: formData.firstScreenId.trim() || null,
      categories: formData.categories,
      jsonDefinition: parsedJson,
    };

    if (flow?.id) {
      await updateMutation.mutateAsync({ id: flow.id, data: payload });
      toast.success('Flow updated');
    } else {
      await createMutation.mutateAsync(payload);
      toast.success('Flow created');
    }
    onClose();
  };

  const handlePublish = async () => {
    if (!flow?.id) {
      toast.error('Save the flow before publishing');
      return;
    }
    await publishMutation.mutateAsync(flow.id);
    toast.success('Flow publish requested');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-5xl flex-col border-l border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">{flow ? flow.name : 'New Flow'}</h2>
            <p className="text-sm text-neutral-500">Build, preview, and publish WhatsApp flows for this company.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPreviewMode((current) => !current)} className="shell-button-secondary">
              <Eye className="h-4 w-4" />
              {previewMode ? 'Edit' : 'Preview'}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-y-auto p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Flow Name</span>
                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="shell-input-rect bg-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Flow Type</span>
                <select value={formData.flowType} onChange={(e) => handleTypeChange(e.target.value)} className="shell-input-rect bg-white">
                  <option value="PACKAGE">Package</option>
                  <option value="PROPERTY">Property</option>
                  <option value="CUSTOM_TRIP">Custom Trip</option>
                  <option value="REVIEW">Review</option>
                  <option value="GENERIC">Generic</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">Endpoint URI</span>
                <input value={formData.endpointUri} onChange={(e) => setFormData({ ...formData, endpointUri: e.target.value })} className="shell-input-rect bg-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-700">First Screen ID</span>
                <input value={formData.firstScreenId} onChange={(e) => setFormData({ ...formData, firstScreenId: e.target.value })} className="shell-input-rect bg-white" />
              </label>
            </div>

            <div className="mt-5">
              <span className="mb-2 block text-sm font-bold text-neutral-700">Flow JSON</span>
              <textarea
                rows={24}
                value={formData.jsonDefinition}
                onChange={(e) => setFormData({ ...formData, jsonDefinition: e.target.value })}
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs text-neutral-700 outline-none transition focus:border-neutral-400 focus:bg-white"
              />
              {!parsedJson && <p className="mt-2 text-sm font-medium text-rose-600">JSON is invalid.</p>}
            </div>
          </div>

          <div className="border-l border-neutral-200 bg-neutral-50/70 p-5">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="eyebrow">Flow Preview</p>
              <h3 className="mt-1 text-base font-bold text-neutral-900">{formData.name || 'Untitled Flow'}</h3>
              <div className="mt-4 rounded-[28px] border-[8px] border-neutral-900 bg-[#efeae2] p-3 shadow-xl">
                <div className="rounded-[14px] bg-[#dcf8c6] p-3 text-sm text-neutral-800">
                  <p className="font-semibold">{formData.firstScreenId || 'First Screen'}</p>
                  <p className="mt-2 text-xs text-neutral-600">
                    {previewMode
                      ? 'Preview mode shows the current screen metadata and saved JSON structure.'
                      : 'Switch to preview to inspect the current flow metadata before publishing.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs text-neutral-500">
                <p>Status: {flow?.status || 'DRAFT'}</p>
                <p>Meta Flow ID: {flow?.metaFlowId || 'Not published yet'}</p>
                <p>Screens: {Array.isArray(parsedJson?.screens) ? parsedJson.screens.length : 0}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="shell-button-primary">
                <Save className="h-4 w-4" />
                Save Flow
              </button>
              <button type="button" onClick={handlePublish} disabled={!flow?.id || publishMutation.isPending} className="shell-button-secondary">
                <Send className="h-4 w-4" />
                Publish
              </button>
              <button type="button" onClick={onClose} className="shell-button-secondary">
                <RefreshCw className="h-4 w-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
