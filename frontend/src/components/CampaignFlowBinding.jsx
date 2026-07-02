import { lazy, Suspense, useMemo, useState } from 'react';
import {
  X, Pencil, Workflow, Plus, ChevronRight, MessageSquare, MousePointerClick, List,
  HelpCircle, GitBranch, LayoutGrid, FileText, ClipboardCheck, Headphones, CheckCircle2, Circle,
} from 'lucide-react';
import { useFlows } from '../hooks/useFlows';
import { useAuthStore } from '../store/authStore';

// The full visual flow builder is heavy; only load it when the agency opens the
// "Build / edit flows" drawer from a campaign.
const SettingsFlowBuilder = lazy(() => import('../pages/settings/SettingsFlowBuilder'));

// Compact label + icon for each builder node type, used by the chain preview.
const NODE_META = {
  MESSAGE: ['Message', MessageSquare],
  BUTTONS: ['Buttons', MousePointerClick],
  LIST: ['List', List],
  QUESTION: ['Question', HelpCircle],
  CONDITION: ['Condition', GitBranch],
  CATALOG_LIST: ['Catalog', LayoutGrid],
  SEARCH: ['Search', LayoutGrid],
  SEND_ITEM_DETAIL: ['Item detail', FileText],
  SEND_ITEM_DOCUMENT: ['Send PDF', FileText],
  SAVE_ENQUIRY: ['Save lead', ClipboardCheck],
  HANDOFF: ['Staff', Headphones],
  END: ['End', CheckCircle2],
};

function nodeMeta(type) {
  if (NODE_META[type]) return NODE_META[type];
  const label = String(type || 'Step').replace(/^OPEN_|_FLOW$/g, '').replace(/_/g, ' ').toLowerCase();
  return [label.charAt(0).toUpperCase() + label.slice(1), Circle];
}

// Walk the flow from its start node following edges to produce a representative
// linear chain of nodes (branches are flattened to the first path).
function flowNodeChain(flow, limit = 6) {
  const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow?.edges) ? flow.edges : [];
  if (!nodes.length) return [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chain = [];
  const seen = new Set();
  let currentId = flow.startNodeId || nodes[0]?.id;
  while (currentId && byId.has(currentId) && !seen.has(currentId) && chain.length < limit) {
    seen.add(currentId);
    chain.push(byId.get(currentId));
    const edge = edges.find((e) => e.source === currentId);
    currentId = edge?.target;
  }
  return chain;
}

// Horizontal node-chain visual (Message → Buttons → Send PDF → End).
function NodeChainPreview({ flow }) {
  const chain = flowNodeChain(flow);
  const total = Array.isArray(flow?.nodes) ? flow.nodes.length : 0;
  if (!chain.length) {
    return <p className="text-xs text-neutral-400">This flow has no steps yet — open the builder to add some.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chain.map((node, index) => {
        const [label, Icon] = nodeMeta(node.type);
        return (
          <div key={node.id || index} className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-[#008069]/20 bg-[#008069]/5 px-2 py-1 text-[11px] font-medium text-[#0b6b59]">
              <Icon className="h-3 w-3" />
              {label}
            </span>
            {index < chain.length - 1 && <ChevronRight className="h-3 w-3 text-neutral-300" />}
          </div>
        );
      })}
      {total > chain.length && <span className="text-[11px] font-medium text-neutral-400">+{total - chain.length} more</span>}
    </div>
  );
}

/**
 * Reusable control that binds a campaign button to a flow. Works for any campaign
 * type (carousel card, CTA button, image-with-buttons). A binding is:
 *   { flowKind: 'GRAPH' | 'META', flowId, keyword }
 *
 * - GRAPH = the agency's bot conversational flow (Send-PDF, branching, catalog
 *           lists, sub-flows). These live in agency.whatsappFlowConfig.flows[]
 *           and can be built/edited inline via the embedded builder.
 * - META  = a published Meta native WhatsApp form flow.
 *
 * The keyword is passed into the launched flow as {campaign_keyword} and saved on
 * the resulting lead, so the flow can branch/personalise and you can report which
 * image/button drove the enquiry.
 */
export default function CampaignFlowBinding({
  value = {},
  onChange,
  showKeyword = true,
  keywordPlaceholder = 'e.g. maldives, honeymoon',
  className = '',
}) {
  const { agency } = useAuthStore();
  const [builderOpen, setBuilderOpen] = useState(false);

  const flowKind = String(value.flowKind || 'GRAPH').toUpperCase();
  const flowId = value.flowId || '';
  const keyword = value.keyword || '';

  // Conversational graph flows (the reusable library the builder edits).
  const graphFlows = useMemo(() => {
    const flows = agency?.whatsappFlowConfig?.flows;
    return Array.isArray(flows)
      ? flows.map((flow) => ({ id: flow.id, name: flow.name || 'Untitled flow' }))
      : [];
  }, [agency?.whatsappFlowConfig]);

  // Published Meta form flows.
  const { data: flowsData } = useFlows({});
  const metaFlows = useMemo(
    () => (flowsData?.data || [])
      .filter((flow) => String(flow.status || '').toUpperCase() === 'PUBLISHED' && flow.metaFlowId)
      .map((flow) => ({ id: flow.id, name: flow.name || 'Untitled flow' })),
    [flowsData],
  );

  const options = flowKind === 'META' ? metaFlows : graphFlows;

  // Full node graph of the selected GRAPH flow, for the chain preview.
  const selectedGraphFlow = useMemo(() => {
    if (flowKind !== 'GRAPH' || !flowId) return null;
    const flows = agency?.whatsappFlowConfig?.flows;
    return Array.isArray(flows) ? flows.find((flow) => flow.id === flowId) || null : null;
  }, [agency?.whatsappFlowConfig, flowKind, flowId]);

  const patch = (updates) => onChange?.({ flowKind, flowId, keyword, ...updates });

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Flow engine toggle */}
        <div className="inline-flex overflow-hidden rounded-lg border border-neutral-200 text-xs">
          {[
            { key: 'GRAPH', label: 'Conversational flow' },
            { key: 'META', label: 'Meta form' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => patch({ flowKind: opt.key, flowId: '' })}
              className={`px-2.5 py-1.5 font-medium transition ${
                flowKind === opt.key ? 'bg-[#008069] text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {flowKind === 'GRAPH' && !flowId && graphFlows.length > 0 && (
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#008069] px-2.5 py-1.5 text-xs font-medium text-[#008069] hover:bg-[#008069]/5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Build / edit flows
          </button>
        )}
      </div>

      {/* Flow picker */}
      <select
        value={flowId}
        onChange={(event) => patch({ flowId: event.target.value })}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#008069]"
      >
        <option value="">
          {options.length ? 'Select a flow…' : (flowKind === 'GRAPH' ? 'No flows yet — build one' : 'No published Meta flows')}
        </option>
        {options.map((flow) => (
          <option key={flow.id} value={flow.id}>{flow.name}</option>
        ))}
      </select>

      {/* Selected conversational flow → show its node chain + edit shortcut, like a
          mini map of what this button triggers. */}
      {flowKind === 'GRAPH' && flowId && (
        <div className="rounded-xl border border-[#008069]/20 bg-[#008069]/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0b6b59]">
              <Workflow className="h-3.5 w-3.5" />
              {selectedGraphFlow?.name || 'Flow'}
            </span>
            <button
              type="button"
              onClick={() => setBuilderOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#008069] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#00735c]"
            >
              <Pencil className="h-3 w-3" />
              Configure flow
            </button>
          </div>
          <NodeChainPreview flow={selectedGraphFlow} />
        </div>
      )}

      {flowKind === 'GRAPH' && !flowId && graphFlows.length === 0 && (
        <button
          type="button"
          onClick={() => setBuilderOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#008069]/40 bg-[#008069]/[0.03] px-3 py-2.5 text-xs font-semibold text-[#0b6b59] hover:bg-[#008069]/[0.06]"
        >
          <Plus className="h-3.5 w-3.5" />
          Build the first flow for this button
        </button>
      )}

      {showKeyword && (
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Keyword (optional) — passed to the flow as {'{campaign_keyword}'} & saved on the lead
          </label>
          <input
            value={keyword}
            onChange={(event) => patch({ keyword: event.target.value.slice(0, 60) })}
            placeholder={keywordPlaceholder}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#008069]"
          />
        </div>
      )}

      {/* Full-screen builder drawer. The builder reads/writes the agency flow
          library, so newly-saved flows appear in the picker on close. */}
      {builderOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
              <Workflow className="h-4 w-4 text-[#008069]" />
              Flow builder
            </div>
            <button
              type="button"
              onClick={() => setBuilderOpen(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              <X className="h-4 w-4" />
              Done
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Loading builder…</div>}>
              {/* Open straight to the flow bound to this button (GRAPH flows are
                  the ones this builder edits), not the generic entry flow. */}
              <SettingsFlowBuilder fullScreen initialFlowId={flowKind === 'GRAPH' ? (flowId || null) : null} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
