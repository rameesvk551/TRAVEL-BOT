import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Bot,
  Check,
  ClipboardCheck,
  CornerUpLeft,
  Database,
  FileText,
  GitBranch,
  Handshake,
  List,
  MessageSquare,
  Monitor,
  MousePointerClick,
  Phone,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Send,
  Square,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { cruisesApi } from '../../api/cruisesApi';
import { flowsApi } from '../../api/flowsApi';
import { packagesApi } from '../../api/packagesApi';
import { propertiesApi } from '../../api/propertiesApi';
import { servicesApi } from '../../api/servicesApi';
import { visasApi } from '../../api/visasApi';
import { useAuthStore } from '../../store/authStore';

const NODE_TYPES = [
  ['MESSAGE', 'Message', MessageSquare],
  ['BUTTONS', 'Buttons', MousePointerClick],
  ['LIST', 'List', List],
  ['QUESTION', 'Question', Send],
  ['CONDITION', 'Condition', GitBranch],
  ['CATALOG_LIST', 'Catalog List', Database],
  ['SEARCH', 'Search', Search],
  ['WHATSAPP_BUTTON', 'WhatsApp Button', Phone],
  ['SEND_ITEM_DETAIL', 'Item Detail', FileText],
  ['SEND_ITEM_DOCUMENT', 'Send PDF', FileText],
  ['SAVE_ENQUIRY', 'Save Enquiry', ClipboardCheck],
  ['NOTIFY_STAFF', 'Notify Staff', Handshake],
  ['OPEN_SERVICE', 'Service', Bot],
  ['OPEN_PACKAGE_FLOW', 'Packages', Square],
  ['OPEN_PROPERTY_FLOW', 'Properties', Square],
  ['OPEN_VISA_FLOW', 'Visas', Square],
  ['OPEN_CRUISE_FLOW', 'Cruises', Square],
  ['OPEN_SERVICE_FLOW', 'Services', Square],
  ['OPEN_CUSTOM_TRIP_FLOW', 'Custom Trip', Square],
  ['OPEN_META_FLOW', 'Meta Flow', Square],
  ['HANDOFF', 'Handoff', Handshake],
  ['END', 'End', Check],
];

const NODE_LABELS = Object.fromEntries([
  ['START', 'Start'],
  ...NODE_TYPES.map(([type, label]) => [type, label]),
]);

const OPTION_NODE_TYPES = new Set(['BUTTONS', 'LIST', 'CONDITION', 'CATALOG_LIST', 'SEARCH']);

const CATALOG_TYPES = [
  ['SERVICE', 'Services'],
  ['PACKAGE', 'Packages'],
  ['PROPERTY', 'Properties'],
  ['VISA', 'Visas'],
  ['CRUISE', 'Cruises'],
];

// Maps flow-builder constructs to the sidebar module path that gates them.
// Anything not listed here (generic nodes, the Entry Menu flow) is always available.
const NODE_TYPE_MODULE = {
  OPEN_SERVICE: '/services',
  OPEN_SERVICE_FLOW: '/services',
  OPEN_PACKAGE_FLOW: '/packages',
  OPEN_CUSTOM_TRIP_FLOW: '/packages',
  OPEN_PROPERTY_FLOW: '/properties',
  OPEN_VISA_FLOW: '/visas',
  OPEN_CRUISE_FLOW: '/cruises',
};
const DOMAIN_FLOW_MODULE = {
  services: '/services',
  packages: '/packages',
  properties: '/properties',
  visas: '/visas',
  cruises: '/cruises',
};
const CATALOG_TYPE_MODULE = {
  SERVICE: '/services',
  PACKAGE: '/packages',
  PROPERTY: '/properties',
  VISA: '/visas',
  CRUISE: '/cruises',
};

// Empty/missing prefs = legacy full access; otherwise only listed modules are enabled.
function isModuleEnabled(prefs, path) {
  if (!path) return true;
  if (!Array.isArray(prefs) || prefs.length === 0) return true;
  return prefs.includes(path);
}

const DEFAULT_GRAPH = {
  schemaVersion: 2,
  startNodeId: 'start',
  nodes: [
    { id: 'start', type: 'START', position: { x: 80, y: 160 }, data: { label: 'Start' } },
    {
      id: 'welcome',
      type: 'MESSAGE',
      position: { x: 330, y: 130 },
      data: {
        body: 'Hi {customerName}\nWelcome to {agencyName}\nHow can I help you today?',
      },
    },
    {
      id: 'main_menu',
      type: 'BUTTONS',
      position: { x: 620, y: 110 },
      data: {
        body: 'Choose an option.',
        buttons: [
          { id: 'packages', label: 'Packages' },
          { id: 'properties', label: 'Properties' },
          { id: 'services', label: 'Services' },
        ],
      },
    },
    { id: 'packages', type: 'OPEN_PACKAGE_FLOW', position: { x: 940, y: 40 }, data: { category: 'DOMESTIC' } },
    { id: 'properties', type: 'OPEN_PROPERTY_FLOW', position: { x: 940, y: 170 }, data: { routingIntentKey: 'staycations' } },
    { id: 'services', type: 'OPEN_SERVICE', position: { x: 940, y: 300 }, data: { serviceKey: 'SERVICE' } },
  ],
  edges: [
    { id: 'start_welcome', source: 'start', sourceHandle: 'default', target: 'welcome' },
    { id: 'welcome_menu', source: 'welcome', sourceHandle: 'default', target: 'main_menu' },
    { id: 'menu_packages', source: 'main_menu', sourceHandle: 'packages', target: 'packages' },
    { id: 'menu_properties', source: 'main_menu', sourceHandle: 'properties', target: 'properties' },
    { id: 'menu_services', source: 'main_menu', sourceHandle: 'services', target: 'services' },
  ],
};

function makeCatalogFlow({ id, name, catalogType, body, questions, filters = {} }) {
  const questionNodes = questions.map((question, index) => ({
    id: `${id}_${question.fieldKey}`,
    type: 'QUESTION',
    position: { x: 920 + index * 260, y: 160 },
    data: { prompt: question.prompt, fieldKey: question.fieldKey },
  }));
  const saveNodeId = `${id}_save`;
  return {
    id,
    name,
    description: `${name} customer enquiry flow`,
    startNodeId: `${id}_start`,
    nodes: [
      { id: `${id}_start`, type: 'START', position: { x: 80, y: 160 }, data: { label: 'Start' } },
      {
        id: `${id}_intro`,
        type: 'MESSAGE',
        position: { x: 320, y: 130 },
        data: { body },
      },
      {
        id: `${id}_catalog`,
        type: 'CATALOG_LIST',
        position: { x: 600, y: 120 },
        data: {
          catalogType,
          body: `Choose a ${name.toLowerCase().replace(/s$/, '')}.`,
          buttonLabel: `View ${name}`.slice(0, 20),
          emptyMessage: `No active ${name.toLowerCase()} are available right now.`,
          itemOverrides: [],
          ...filters,
        },
      },
      {
        id: `${id}_detail`,
        type: 'SEND_ITEM_DETAIL',
        position: { x: 860, y: 80 },
        data: { catalogType: 'AUTO', message: '' },
      },
      ...questionNodes,
      {
        id: saveNodeId,
        type: 'SAVE_ENQUIRY',
        position: { x: 920 + questions.length * 260, y: 160 },
        data: {
          notePrefix: `${name} enquiry`,
          finalMessage: 'Thank you. Our team will contact you shortly.',
          status: 'ENQUIRY',
        },
      },
      {
        id: `${id}_empty_end`,
        type: 'END',
        position: { x: 860, y: 300 },
        data: { message: 'Please message us with your requirement and our team will help you shortly.' },
      },
    ],
    edges: [
      { id: `${id}_start_intro`, source: `${id}_start`, sourceHandle: 'default', target: `${id}_intro` },
      { id: `${id}_intro_catalog`, source: `${id}_intro`, sourceHandle: 'default', target: `${id}_catalog` },
      { id: `${id}_catalog_selected`, source: `${id}_catalog`, sourceHandle: 'selected', target: `${id}_detail` },
      { id: `${id}_catalog_empty`, source: `${id}_catalog`, sourceHandle: 'empty', target: `${id}_empty_end` },
      { id: `${id}_detail_first_question`, source: `${id}_detail`, sourceHandle: 'default', target: questionNodes[0]?.id || saveNodeId },
      ...questionNodes.map((node, index) => ({
        id: `${node.id}_next`,
        source: node.id,
        sourceHandle: 'default',
        target: questionNodes[index + 1]?.id || saveNodeId,
      })),
    ],
  };
}

const DEFAULT_DOMAIN_FLOWS = [
  makeCatalogFlow({
    id: 'services',
    name: 'Services',
    catalogType: 'SERVICE',
    body: 'Let us collect the details for your service request.',
    questions: [
      { fieldKey: 'from', prompt: 'From where?' },
      { fieldKey: 'to', prompt: 'To where?' },
      { fieldKey: 'travelDate', prompt: 'When do you want to travel?' },
      { fieldKey: 'people', prompt: 'How many people?' },
    ],
  }),
  makeCatalogFlow({
    id: 'packages',
    name: 'Packages',
    catalogType: 'PACKAGE',
    body: 'Great choice. Please share a few details for this package.',
    questions: [
      { fieldKey: 'travelDate', prompt: 'Preferred travel date?' },
      { fieldKey: 'people', prompt: 'How many travellers?' },
      { fieldKey: 'budget', prompt: 'Approx budget per person?' },
      { fieldKey: 'notes', prompt: 'Any special requirement?' },
    ],
  }),
  makeCatalogFlow({
    id: 'properties',
    name: 'Properties',
    catalogType: 'PROPERTY',
    body: 'Let us check availability for this property.',
    questions: [
      { fieldKey: 'checkInDate', prompt: 'Check-in date?' },
      { fieldKey: 'checkOutDate', prompt: 'Check-out date?' },
      { fieldKey: 'people', prompt: 'How many guests?' },
      { fieldKey: 'notes', prompt: 'Any room or stay preference?' },
    ],
  }),
  makeCatalogFlow({
    id: 'visas',
    name: 'Visas',
    catalogType: 'VISA',
    body: 'Let us collect visa enquiry details.',
    questions: [
      { fieldKey: 'country', prompt: 'Which country visa do you need?' },
      { fieldKey: 'travelDate', prompt: 'Expected travel date?' },
      { fieldKey: 'people', prompt: 'How many applicants?' },
      { fieldKey: 'notes', prompt: 'Any extra details?' },
    ],
  }),
  makeCatalogFlow({
    id: 'cruises',
    name: 'Cruises',
    catalogType: 'CRUISE',
    body: 'Let us collect details for your cruise enquiry.',
    questions: [
      { fieldKey: 'destination', prompt: 'Preferred cruise destination?' },
      { fieldKey: 'travelDate', prompt: 'Preferred travel month or date?' },
      { fieldKey: 'people', prompt: 'How many travellers?' },
      { fieldKey: 'notes', prompt: 'Any cabin or cruise preference?' },
    ],
  }),
];

// Pre-built starter flows an agency can pick from the gallery and then edit freely.
function buildSearchEnquiryTemplate() {
  return {
    id: 'search_enquiry',
    name: 'Search Enquiry',
    description: 'Menu → questions → typo-tolerant inventory search → pick → lead + agent assignment',
    startNodeId: 'se_start',
    nodes: [
      { id: 'se_start', type: 'START', position: { x: 60, y: 320 }, data: { label: 'Start' } },
      { id: 'se_welcome', type: 'MESSAGE', position: { x: 280, y: 300 }, data: { body: 'Hi {customerName}\nWelcome to {agencyName}\nHow can I help you today?' } },
      { id: 'se_menu', type: 'BUTTONS', position: { x: 540, y: 280 }, data: { body: 'Choose an option.', buttons: [{ id: 'packages', label: 'Packages' }, { id: 'properties', label: 'Properties' }, { id: 'services', label: 'Services' }] } },
      { id: 'pk_dest', type: 'QUESTION', position: { x: 840, y: 60 }, data: { prompt: 'Which destination are you interested in?', fieldKey: 'destination' } },
      { id: 'pk_search', type: 'SEARCH', position: { x: 1100, y: 60 }, data: { catalogType: 'PACKAGE', body: 'Here are matching packages:', searchMappings: [{ fieldKey: 'destination', matchField: 'destinations' }], maxResults: 6, pickPrompt: 'Reply with the number of your choice.', emptyMessage: 'Sorry, I could not find a package for that. Our team will help you shortly.' } },
      { id: 'pk_pdf', type: 'SEND_ITEM_DOCUMENT', position: { x: 1360, y: 40 }, data: { fallbackMessage: 'The brochure is not available yet. Our team will share it shortly.' } },
      { id: 'pk_save', type: 'SAVE_ENQUIRY', position: { x: 1620, y: 60 }, data: { status: 'ENQUIRY', notePrefix: 'Package enquiry', finalMessage: '' } },
      { id: 'pr_type', type: 'QUESTION', position: { x: 840, y: 300 }, data: { prompt: 'What type of stay are you looking for? (e.g. villa, resort)', fieldKey: 'stayType' } },
      { id: 'pr_place', type: 'QUESTION', position: { x: 1060, y: 300 }, data: { prompt: 'Where would you like to go?', fieldKey: 'place' } },
      { id: 'pr_search', type: 'SEARCH', position: { x: 1300, y: 300 }, data: { catalogType: 'PROPERTY', body: 'Here are matching stays:', searchMappings: [{ fieldKey: 'stayType', matchField: 'propertyType' }, { fieldKey: 'place', matchField: 'location' }], maxResults: 6, pickPrompt: 'Reply with the number of your choice.', emptyMessage: 'Sorry, I could not find a stay for that. Our team will help you shortly.' } },
      { id: 'pr_detail', type: 'SEND_ITEM_DETAIL', position: { x: 1560, y: 280 }, data: { catalogType: 'AUTO', message: '' } },
      { id: 'pr_save', type: 'SAVE_ENQUIRY', position: { x: 1800, y: 300 }, data: { status: 'ENQUIRY', notePrefix: 'Property enquiry', finalMessage: '' } },
      { id: 'sv_list', type: 'CATALOG_LIST', position: { x: 840, y: 560 }, data: { catalogType: 'SERVICE', body: 'Choose a service.', buttonLabel: 'View Services', category: '', emptyMessage: 'No active services right now.', itemOverrides: [] } },
      { id: 'sv_q', type: 'QUESTION', position: { x: 1100, y: 560 }, data: { prompt: 'Please share the details for this service.', fieldKey: 'serviceDetails' } },
      { id: 'sv_save', type: 'SAVE_ENQUIRY', position: { x: 1360, y: 560 }, data: { status: 'ENQUIRY', notePrefix: 'Service enquiry', finalMessage: '' } },
      { id: 'se_chat', type: 'WHATSAPP_BUTTON', position: { x: 1900, y: 560 }, data: { body: 'Thank you! 🙏 Our team will contact you shortly.\n\nYou can chat with {staffName} on WhatsApp 👇', buttonLabel: 'Chat on WhatsApp', target: 'ASSIGNED_AGENT', phone: '' } },
      { id: 'se_handoff', type: 'HANDOFF', position: { x: 1360, y: 760 }, data: { reason: 'No inventory match from search' } },
    ],
    edges: [
      { id: 'se1', source: 'se_start', sourceHandle: 'default', target: 'se_welcome' },
      { id: 'se2', source: 'se_welcome', sourceHandle: 'default', target: 'se_menu' },
      { id: 'se3', source: 'se_menu', sourceHandle: 'packages', target: 'pk_dest' },
      { id: 'se4', source: 'se_menu', sourceHandle: 'properties', target: 'pr_type' },
      { id: 'se5', source: 'se_menu', sourceHandle: 'services', target: 'sv_list' },
      { id: 'se6', source: 'pk_dest', sourceHandle: 'default', target: 'pk_search' },
      { id: 'se7', source: 'pk_search', sourceHandle: 'selected', target: 'pk_pdf' },
      { id: 'se8', source: 'pk_search', sourceHandle: 'empty', target: 'se_handoff' },
      { id: 'se9', source: 'pk_pdf', sourceHandle: 'default', target: 'pk_save' },
      { id: 'se10', source: 'pr_type', sourceHandle: 'default', target: 'pr_place' },
      { id: 'se11', source: 'pr_place', sourceHandle: 'default', target: 'pr_search' },
      { id: 'se12', source: 'pr_search', sourceHandle: 'selected', target: 'pr_detail' },
      { id: 'se13', source: 'pr_search', sourceHandle: 'empty', target: 'se_handoff' },
      { id: 'se14', source: 'pr_detail', sourceHandle: 'default', target: 'pr_save' },
      { id: 'se15', source: 'sv_list', sourceHandle: 'selected', target: 'sv_q' },
      { id: 'se16', source: 'sv_list', sourceHandle: 'empty', target: 'se_handoff' },
      { id: 'se17', source: 'sv_q', sourceHandle: 'default', target: 'sv_save' },
      { id: 'se18', source: 'pk_save', sourceHandle: 'default', target: 'se_chat' },
      { id: 'se19', source: 'pr_save', sourceHandle: 'default', target: 'se_chat' },
      { id: 'se20', source: 'sv_save', sourceHandle: 'default', target: 'se_chat' },
    ],
  };
}

const FLOW_TEMPLATES = [buildSearchEnquiryTemplate()];

function cloneTemplateFlow(template, newId) {
  const clone = JSON.parse(JSON.stringify(template));
  clone.id = newId;
  return clone;
}

function graphToEditableFlow(graph, fallbackId = 'entry', fallbackName = 'Entry Flow') {
  return {
    id: toNodeId(graph?.id, fallbackId),
    name: String(graph?.name || fallbackName).slice(0, 40),
    description: String(graph?.description || '').slice(0, 120),
    startNodeId: graph?.startNodeId || 'start',
    nodes: Array.isArray(graph?.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph?.edges) ? graph.edges : [],
  };
}

// Build a fresh campaign flow seeded with one starter node per template button, so
// the agency sees each approved-template button as an entry point and branches out.
// Entry node ids are deterministic (`entry_1`..`entry_N`) so the campaign page can
// bind each button → its node without reading builder state.
function buildButtonSeedFlow(id, name, buttons = []) {
  const nodes = [{ id: 'start', type: 'START', position: { x: 40, y: 200 }, data: { label: 'Start' } }];
  const edges = [];
  const endId = 'end_done';
  buttons.forEach((button, index) => {
    const nodeId = button.nodeId || `entry_${index + 1}`;
    nodes.push({
      id: nodeId,
      type: 'MESSAGE',
      position: { x: 340, y: 40 + index * 170 },
      data: { title: button.label || `Button ${index + 1}`, body: `When they tap “${button.label || `Button ${index + 1}`}”, reply here.` },
    });
    // Seed a VALID graph: Start reaches every entry node, and each entry flows to a
    // shared End — so the flow saves immediately (Save is blocked on validation).
    // The agency inserts their real steps between an entry node and End.
    edges.push({ id: `e_start_${nodeId}`, source: 'start', sourceHandle: 'default', target: nodeId });
    edges.push({ id: `e_${nodeId}_end`, source: nodeId, sourceHandle: 'default', target: endId });
  });
  nodes.push({ id: endId, type: 'END', position: { x: 660, y: 200 }, data: {} });
  return { id, name: String(name || 'Campaign flow').slice(0, 40), startNodeId: 'start', nodes, edges };
}

function graphPayloadFromState(flow, nodes, edges) {
  const startNode = nodes.find((node) => node.type === 'START');
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description || '',
    startNodeId: startNode?.id || flow.startNodeId || 'start',
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data || {},
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle || 'default',
      target: edge.target,
    })),
  };
}

function flowLibraryFromAgencyConfig(config) {
  if (Number(config?.schemaVersion) >= 4 && Array.isArray(config.flows)) {
    const flows = config.flows
      .map((flow, index) => graphToEditableFlow(flow, `flow_${index + 1}`, flow.name || `Flow ${index + 1}`))
      .filter((flow) => flow.nodes.length && flow.edges.length);
    const merged = flows.length ? flows : [graphToEditableFlow(DEFAULT_GRAPH, 'entry', 'Entry Menu')];
    return {
      entryFlowId: merged.some((flow) => flow.id === config.entryFlowId) ? config.entryFlowId : merged[0]?.id || 'entry',
      flows: merged,
    };
  }

  const entryGraph = graphFromAgencyConfig(config);
  const entryFlow = graphToEditableFlow(entryGraph, 'entry', 'Entry Menu');
  return {
    entryFlowId: entryFlow.id,
    flows: [entryFlow],
  };
}

function toNodeId(value, fallback = 'node') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function catalogHandle(catalogType, itemId) {
  return `item:${String(catalogType || 'SERVICE').toLowerCase()}:${String(itemId || '').trim()}`;
}

function getDefaultNodeData(type) {
  const defaults = {
    START: { label: 'Start' },
    MESSAGE: { body: 'Thanks for messaging {agencyName}.' },
    BUTTONS: {
      body: 'Choose an option.',
      buttons: [
        { id: 'option_1', label: 'Option 1' },
        { id: 'option_2', label: 'Option 2' },
      ],
    },
    LIST: {
      body: 'Choose an option.',
      buttonLabel: 'Choose',
      rows: [
        { id: 'option_1', title: 'Option 1', description: '' },
        { id: 'option_2', title: 'Option 2', description: '' },
      ],
    },
    QUESTION: { prompt: 'Please share the details.', fieldKey: 'answer' },
    CONDITION: { fieldKey: 'answer', operator: 'EXISTS', value: '' },
    CATALOG_LIST: {
      catalogType: 'SERVICE',
      body: 'Please choose a service.',
      buttonLabel: 'View Options',
      category: '',
      emptyMessage: 'No active options are available right now.',
      itemOverrides: [],
      askLocationFirst: false,
      locationPrompt: 'Which location are you interested in?',
      locationButtonLabel: 'Choose Location',
      propertyLocationField: 'propertyLocation',
    },
    SEARCH: {
      catalogType: 'PROPERTY',
      body: 'Here are the closest matches:',
      searchMappings: [{ fieldKey: '', matchField: '' }],
      maxResults: 6,
      pickPrompt: 'Reply with the number of your choice.',
      emptyMessage: 'Sorry, I could not find a match for that. Our team will help you shortly.',
    },
    WHATSAPP_BUTTON: {
      body: 'Tap below to chat with us on WhatsApp.',
      buttonLabel: 'Chat on WhatsApp',
      target: 'ASSIGNED_AGENT',
      phone: '',
    },
    SEND_ITEM_DETAIL: { catalogType: 'AUTO', message: '' },
    SEND_ITEM_DOCUMENT: { catalogType: 'PACKAGE', documentSource: 'AUTO', fallbackMessage: 'The PDF is not available yet. Our team will share it shortly.' },
    SAVE_ENQUIRY: { status: 'ENQUIRY', notePrefix: 'Flow enquiry', finalMessage: 'Thank you. Our team will contact you shortly.' },
    NOTIFY_STAFF: { staffMessage: 'New Enquiry\n\nName: {guestName}\nContact : {customerPhone}\nPackage: {packageName}\n\nTap the phone number above to call the customer.' },
    OPEN_SERVICE: { serviceKey: 'SERVICE' },
    OPEN_PACKAGE_FLOW: { category: 'DOMESTIC', tourType: '' },
    OPEN_PROPERTY_FLOW: { routingIntentKey: 'staycations', propertyType: '', propertyLocation: '' },
    OPEN_VISA_FLOW: { country: '', visaType: '' },
    OPEN_CRUISE_FLOW: { destination: '', cruiseLine: '' },
    OPEN_SERVICE_FLOW: { category: '' },
    OPEN_CUSTOM_TRIP_FLOW: {},
    OPEN_META_FLOW: { flowId: '', flowType: 'GENERIC', body: 'Please complete the form below.', cta: 'Open Form' },
    HANDOFF: { reason: 'Requested from WhatsApp flow builder' },
    END: { message: 'Thank you. Our team will contact you shortly.' },
  };
  return defaults[type] || {};
}

function legacyItemToNode(item, index) {
  const id = toNodeId(item.id, `legacy_action_${index + 1}`);
  const action = String(item.action || '').toUpperCase();
  if (action === 'OPEN_PROPERTY_FLOW') return { id, type: 'OPEN_PROPERTY_FLOW', data: { routingIntentKey: item.value || item.category || 'staycations' } };
  if (action === 'OPEN_SERVICE_MENU' || action === 'CAPTURE_SERVICE_DETAILS') return { id, type: 'OPEN_SERVICE', data: { serviceCategory: item.category || '', serviceKey: item.tourType || item.value || item.id || '' } };
  if (action === 'OPEN_CUSTOM_TRIP_FLOW') return { id, type: 'OPEN_CUSTOM_TRIP_FLOW', data: {} };
  return { id, type: 'OPEN_PACKAGE_FLOW', data: { category: item.category || 'DOMESTIC', tourType: item.tourType || item.value || '' } };
}

function graphFromAgencyConfig(config) {
  if (Number(config?.schemaVersion) >= 2 && Array.isArray(config.nodes) && Array.isArray(config.edges)) {
    return {
      schemaVersion: 2,
      startNodeId: config.startNodeId || 'start',
      nodes: config.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position || { x: 0, y: 0 },
        data: node.data || {},
      })),
      edges: config.edges || [],
    };
  }

  const welcomeMenu = Array.isArray(config?.welcomeMenu) ? config.welcomeMenu : [];
  if (!welcomeMenu.length) return DEFAULT_GRAPH;

  const actionNodes = welcomeMenu.map(legacyItemToNode);
  return {
    schemaVersion: 2,
    startNodeId: 'start',
    nodes: [
      { id: 'start', type: 'START', position: { x: 80, y: 160 }, data: { label: 'Start' } },
      { id: 'welcome', type: 'MESSAGE', position: { x: 330, y: 130 }, data: { body: 'Hi {customerName}\nWelcome to {agencyName}\nHow can I help you today?' } },
      {
        id: 'main_menu',
        type: welcomeMenu.length <= 3 ? 'BUTTONS' : 'LIST',
        position: { x: 620, y: 110 },
        data: welcomeMenu.length <= 3
          ? { body: 'Choose an option.', buttons: welcomeMenu.slice(0, 3).map((item) => ({ id: toNodeId(item.id, item.title), label: String(item.title || '').slice(0, 20) })) }
          : { body: 'Choose an option.', buttonLabel: 'Choose', rows: welcomeMenu.slice(0, 10).map((item) => ({ id: toNodeId(item.id, item.title), title: String(item.title || '').slice(0, 24), description: String(item.description || '').slice(0, 72) })) },
      },
      ...actionNodes.map((node, index) => ({
        ...node,
        position: { x: 940, y: 40 + index * 130 },
      })),
    ],
    edges: [
      { id: 'start_welcome', source: 'start', sourceHandle: 'default', target: 'welcome' },
      { id: 'welcome_menu', source: 'welcome', sourceHandle: 'default', target: 'main_menu' },
      ...actionNodes.map((node, index) => ({
        id: `main_menu_${node.id}`,
        source: 'main_menu',
        sourceHandle: toNodeId(welcomeMenu[index]?.id, welcomeMenu[index]?.title),
        target: node.id,
      })),
    ],
  };
}

function asReactNodes(graph) {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position || { x: 0, y: 0 },
    data: node.data || {},
  }));
}

function asReactEdges(graph) {
  return (graph.edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle || 'default',
    target: edge.target,
  }));
}

function FlowNode({ id, type, data, selected }) {
  const options = type === 'BUTTONS'
    ? data.buttons || []
    : type === 'LIST'
      ? data.rows || []
      : type === 'CONDITION'
        ? [{ id: 'true', label: 'Yes' }, { id: 'false', label: 'No' }]
        : type === 'CATALOG_LIST'
          ? [
              { id: 'selected', label: 'Default item' },
              { id: 'empty', label: 'No items' },
              ...(data.itemOverrides || []).map((item) => ({
                id: catalogHandle(data.catalogType, item.itemId),
                label: item.label || item.itemName || item.itemId,
              })),
            ]
        : type === 'SEARCH'
          ? [
              { id: 'selected', label: 'Selected item' },
              { id: 'empty', label: 'No matches' },
            ]
        : [];
  return (
    <div className={`min-w-[210px] rounded-lg border bg-white shadow-sm ${selected ? 'border-neutral-900 ring-2 ring-neutral-900/10' : 'border-neutral-200'}`}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-neutral-500" />
      <div className="border-b border-neutral-100 px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{NODE_LABELS[type] || type}</p>
        <p className="mt-1 max-w-[180px] truncate text-sm font-bold text-neutral-900">{data.label || data.title || data.fieldKey || id}</p>
      </div>
      <div className="px-3 py-2 text-xs text-neutral-500">
        {type === 'MESSAGE' ? String(data.body || 'Message').slice(0, 90) : null}
        {type === 'QUESTION' ? String(data.prompt || 'Question').slice(0, 90) : null}
        {type === 'BUTTONS' ? `${(data.buttons || []).length} buttons` : null}
        {type === 'LIST' ? `${(data.rows || []).length} list rows` : null}
        {type === 'CATALOG_LIST' ? `${data.catalogType || 'SERVICE'} catalog route` : null}
        {type === 'SEARCH' ? `Search ${data.catalogType || 'PROPERTY'} → cards` : null}
        {type === 'WHATSAPP_BUTTON' ? `WhatsApp button → ${data.target === 'CUSTOM' ? (data.phone || 'custom number') : 'assigned staff'}` : null}
        {type === 'SEND_ITEM_DETAIL' ? 'Sends selected item details' : null}
        {type === 'SEND_ITEM_DOCUMENT' ? 'Sends selected package PDF' : null}
        {type === 'SAVE_ENQUIRY' ? 'Saves answers to lead' : null}
        {type === 'NOTIFY_STAFF' ? 'Sends message to assigned staff' : null}
        {type === 'CONDITION' ? `${data.fieldKey || 'field'} ${String(data.operator || 'EXISTS').toLowerCase()}` : null}
        {type?.startsWith('OPEN_') ? 'Opens a bot action' : null}
        {type === 'HANDOFF' ? 'Assign to an agent' : null}
        {type === 'END' ? 'Complete conversation' : null}
        {type === 'START' ? 'Conversation entry' : null}
      </div>
      {OPTION_NODE_TYPES.has(type) ? (
        <div className="space-y-1 border-t border-neutral-100 px-3 py-2">
          {options.map((option) => (
            <div key={option.id} className="relative rounded-md bg-neutral-50 px-2 py-1 text-[11px] font-semibold text-neutral-600">
              {option.label || option.title || option.id}
              <Handle
                type="source"
                id={option.id}
                position={Position.Right}
                className="!h-3 !w-3 !bg-[#00A884]"
                style={{ top: '50%', right: -7 }}
              />
            </div>
          ))}
        </div>
      ) : (
        <Handle type="source" id="default" position={Position.Right} className="!h-3 !w-3 !bg-[#00A884]" />
      )}
    </div>
  );
}

const nodeTypes = Object.fromEntries(['START', ...NODE_TYPES.map(([type]) => type)].map((type) => [type, FlowNode]));

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function validateGraph(nodes, edges) {
  const issues = [];
  const startNodes = nodes.filter((node) => node.type === 'START');
  if (startNodes.length !== 1) issues.push('Flow must contain exactly one Start node.');
  const nodeIds = new Set(nodes.map((node) => node.id));
  const outgoing = new Map();
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) issues.push('Every connector must point to an existing node.');
    const key = `${edge.source}:${edge.sourceHandle || 'default'}`;
    outgoing.set(key, edge.target);
  });
  nodes.forEach((node) => {
    if (node.type === 'BUTTONS') {
      const buttons = node.data?.buttons || [];
      if (!buttons.length || buttons.length > 3) issues.push(`Buttons node "${node.id}" needs 1 to 3 buttons.`);
      buttons.forEach((button) => {
        if (!outgoing.has(`${node.id}:${button.id}`)) issues.push(`Button "${button.label || button.id}" is not connected.`);
      });
    }
    if (node.type === 'LIST') {
      const rows = node.data?.rows || [];
      if (!rows.length || rows.length > 10) issues.push(`List node "${node.id}" needs 1 to 10 rows.`);
      rows.forEach((row) => {
        if (!outgoing.has(`${node.id}:${row.id}`)) issues.push(`List row "${row.title || row.id}" is not connected.`);
      });
    }
    if (node.type === 'CATALOG_LIST') {
      if (!outgoing.has(`${node.id}:selected`)) issues.push(`Catalog list "${node.id}" needs a default item route.`);
      (node.data?.itemOverrides || []).forEach((item) => {
        const handle = catalogHandle(node.data?.catalogType, item.itemId);
        if (item.itemId && !outgoing.has(`${node.id}:${handle}`)) issues.push(`Catalog override "${item.label || item.itemId}" is not connected.`);
      });
    }
    if (node.type === 'SEARCH') {
      if (!outgoing.has(`${node.id}:selected`)) issues.push(`Search "${node.id}" needs a Selected item route.`);
      const mappings = (node.data?.searchMappings || []).filter((m) => m && m.fieldKey && m.matchField);
      if (!mappings.length) issues.push(`Search "${node.id}" needs at least one search field mapping.`);
    }
    if (!OPTION_NODE_TYPES.has(node.type) && !['END', 'HANDOFF', 'SAVE_ENQUIRY', 'NOTIFY_STAFF', 'SEND_ITEM_DETAIL', 'SEND_ITEM_DOCUMENT', 'WHATSAPP_BUTTON', 'OPEN_SERVICE', 'OPEN_PACKAGE_FLOW', 'OPEN_PROPERTY_FLOW', 'OPEN_VISA_FLOW', 'OPEN_CRUISE_FLOW', 'OPEN_SERVICE_FLOW', 'OPEN_CUSTOM_TRIP_FLOW', 'OPEN_META_FLOW'].includes(node.type)) {
      if (!outgoing.has(`${node.id}:default`)) issues.push(`Node "${node.id}" needs a connector.`);
    }
  });
  if (startNodes.length === 1) {
    const visited = new Set();
    const stack = [startNodes[0].id];
    while (stack.length) {
      const id = stack.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      edges.filter((edge) => edge.source === id).forEach((edge) => stack.push(edge.target));
    }
    nodes.forEach((node) => {
      if (!visited.has(node.id)) issues.push(`Node "${node.id}" is disconnected from Start.`);
    });
  }
  return [...new Set(issues)];
}

function TextInput(props) {
  return <input {...props} className="shell-input-rect bg-white text-sm" />;
}

function TextArea(props) {
  return <textarea {...props} className="shell-input-rect min-h-[110px] resize-y bg-white text-sm" />;
}

// Inventory fields a SEARCH node can match a collected answer against, per catalog type.
function searchFieldOptions(catalogType) {
  const map = {
    PROPERTY: ['propertyType', 'location', 'name'],
    PACKAGE: ['destinations', 'tourType', 'category', 'name'],
    SERVICE: ['category', 'name'],
    VISA: ['country', 'visaType'],
    CRUISE: ['destinations', 'cruiseLine', 'name'],
  };
  return map[catalogType] || ['name'];
}

function catalogItemLabel(item, catalogType) {
  if (!item) return '';
  if (catalogType === 'VISA') return [item.country, item.visaType].filter(Boolean).join(' - ') || 'Visa';
  return item.name || item.title || item.country || item.id;
}

function catalogItemMeta(item, catalogType) {
  if (!item) return '';
  if (catalogType === 'SERVICE') return item.category || item.description || '';
  if (catalogType === 'PACKAGE') return [item.category, item.tourType, item.duration].filter(Boolean).join(' - ');
  if (catalogType === 'PROPERTY') return [item.propertyType, item.location].filter(Boolean).join(' - ');
  if (catalogType === 'VISA') return [item.processingTime, item.price ? formatPrice(item.price / 100) : ''].filter(Boolean).join(' - ');
  if (catalogType === 'CRUISE') return [item.cruiseLine, item.duration].filter(Boolean).join(' - ');
  return '';
}

function getCatalogItemsForType(catalogItems, catalogType) {
  return catalogItems[catalogType] || [];
}

function extractList(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

// Editor for the SEND_ITEM_DOCUMENT node. The document source list is gated by the
// agency's sidebar preferences (catalogTypes is already filtered upstream), so a
// resort owner without Packages enabled won't see package/itinerary sources.
function SendDocumentFields({ data, update, catalogTypes = [] }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const enabled = new Set((catalogTypes || []).map(([value]) => value));
  const sources = [
    { value: 'AUTO', label: 'Auto (the tapped item’s document)', enabled: true },
    { value: 'BROCHURE', label: 'Package brochure', enabled: enabled.has('PACKAGE') },
    { value: 'ITINERARY', label: 'Package itinerary PDF', enabled: enabled.has('PACKAGE') },
    { value: 'PROPERTY_DOC', label: 'Property document', enabled: enabled.has('PROPERTY') },
    { value: 'UPLOAD', label: 'Uploaded PDF (fixed file)', enabled: true },
  ].filter((source) => source.enabled);
  const source = data.documentSource || 'AUTO';

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please choose a PDF file.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('PDF must be 50 MB or smaller.');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const res = await client.post('/uploads/pdf', formData);
      const uploaded = res.data?.data || {};
      update({ uploadedPdfUrl: uploaded.url, uploadedPdfName: uploaded.fileName || file.name });
    } catch (err) {
      setUploadError(err?.response?.data?.message || 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Field label="Document source">
        <select value={source} onChange={(event) => update({ documentSource: event.target.value })} className="shell-input-rect bg-white text-sm">
          {sources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Field>

      {source === 'UPLOAD' ? (
        <Field label="PDF file">
          <div className="space-y-1">
            {data.uploadedPdfUrl ? (
              <p className="truncate text-xs font-medium text-emerald-700">Uploaded: {data.uploadedPdfName || 'document.pdf'}</p>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:border-neutral-400">
              <input type="file" accept="application/pdf,.pdf" onChange={handleUpload} className="hidden" />
              {uploading ? 'Uploading…' : data.uploadedPdfUrl ? 'Replace PDF' : 'Upload PDF'}
            </label>
            {uploadError ? <p className="text-xs font-medium text-rose-600">{uploadError}</p> : null}
          </div>
        </Field>
      ) : null}

      <Field label="Caption (optional)">
        <input value={data.documentCaption || ''} onChange={(event) => update({ documentCaption: event.target.value.slice(0, 200) })} className="shell-input-rect bg-white text-sm" placeholder="Sent with the PDF" />
      </Field>

      <Field label="Fallback message">
        <TextArea value={data.fallbackMessage || ''} onChange={(event) => update({ fallbackMessage: event.target.value.slice(0, 300) })} />
      </Field>
    </>
  );
}

function Inspector({ selectedNode, updateNodeData, services, flows, propertyOptions, catalogItems, catalogTypes = CATALOG_TYPES }) {
  if (!selectedNode) {
    return <div className="rounded-lg border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">Select a node to edit its settings.</div>;
  }

  const data = selectedNode.data || {};
  const update = (patch) => updateNodeData(selectedNode.id, patch);
  const updateOption = (collection, index, patch) => {
    const items = [...(data[collection] || [])];
    items[index] = { ...items[index], ...patch };
    update({ [collection]: items });
  };
  const addOption = (collection, limit) => {
    const items = [...(data[collection] || [])];
    if (items.length >= limit) return;
    const next = collection === 'buttons'
      ? { id: `option_${items.length + 1}`, label: `Option ${items.length + 1}` }
      : { id: `option_${items.length + 1}`, title: `Option ${items.length + 1}`, description: '' };
    update({ [collection]: [...items, next] });
  };
  const removeOption = (collection, index) => update({ [collection]: (data[collection] || []).filter((_, itemIndex) => itemIndex !== index) });
  const catalogType = data.catalogType || 'SERVICE';
  const selectedCatalogItems = getCatalogItemsForType(catalogItems, catalogType);
  const overrideIds = new Set((data.itemOverrides || []).map((item) => String(item.itemId)));
  const addCatalogOverride = (item) => {
    if (!item?.id || overrideIds.has(String(item.id))) return;
    update({
      itemOverrides: [
        ...(data.itemOverrides || []),
        {
          itemType: catalogType,
          itemId: String(item.id),
          label: catalogItemLabel(item, catalogType).slice(0, 48),
        },
      ],
    });
  };
  const removeCatalogOverride = (itemId) => update({ itemOverrides: (data.itemOverrides || []).filter((item) => String(item.itemId) !== String(itemId)) });
  const searchMappings = Array.isArray(data.searchMappings) ? data.searchMappings : [];
  const addSearchMapping = () => update({ searchMappings: [...searchMappings, { fieldKey: '', matchField: '' }] });
  const updateSearchMapping = (index, patch) => {
    const next = [...searchMappings];
    next[index] = { ...next[index], ...patch };
    update({ searchMappings: next });
  };
  const removeSearchMapping = (index) => update({ searchMappings: searchMappings.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <p className="text-sm font-extrabold text-neutral-900">{NODE_LABELS[selectedNode.type] || selectedNode.type}</p>
        <p className="mt-1 text-xs text-neutral-500">{selectedNode.id}</p>
      </div>

      {['MESSAGE', 'BUTTONS', 'LIST', 'OPEN_META_FLOW'].includes(selectedNode.type) ? (
        <Field label="Message body">
          <TextArea value={data.body || ''} onChange={(event) => update({ body: event.target.value.slice(0, 1024) })} />
        </Field>
      ) : null}

      {selectedNode.type === 'QUESTION' ? (
        <>
          <Field label="Question">
            <TextArea value={data.prompt || ''} onChange={(event) => update({ prompt: event.target.value.slice(0, 1024) })} />
          </Field>
          <Field label="Save answer as">
            <TextInput value={data.fieldKey || ''} onChange={(event) => update({ fieldKey: toNodeId(event.target.value, 'answer') })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'BUTTONS' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-neutral-500">Buttons</p>
            <button type="button" onClick={() => addOption('buttons', 3)} className="shell-button-secondary px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Add</button>
          </div>
          {(data.buttons || []).map((button, index) => (
            <div key={`${button.id}-${index}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <Field label="Label">
                <TextInput value={button.label || ''} maxLength={20} onChange={(event) => updateOption('buttons', index, { label: event.target.value.slice(0, 20), id: button.id || toNodeId(event.target.value, `button_${index + 1}`) })} />
              </Field>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <TextInput value={button.id || ''} onChange={(event) => updateOption('buttons', index, { id: toNodeId(event.target.value, `button_${index + 1}`) })} />
                <button type="button" onClick={() => removeOption('buttons', index)} className="shell-button-secondary px-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {selectedNode.type === 'LIST' ? (
        <div className="space-y-3">
          <Field label="List button label">
            <TextInput value={data.buttonLabel || ''} maxLength={20} onChange={(event) => update({ buttonLabel: event.target.value.slice(0, 20) })} />
          </Field>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-neutral-500">Rows</p>
            <button type="button" onClick={() => addOption('rows', 10)} className="shell-button-secondary px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Add</button>
          </div>
          {(data.rows || []).map((row, index) => (
            <div key={`${row.id}-${index}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <Field label="Title">
                <TextInput value={row.title || ''} maxLength={24} onChange={(event) => updateOption('rows', index, { title: event.target.value.slice(0, 24), id: row.id || toNodeId(event.target.value, `row_${index + 1}`) })} />
              </Field>
              <div className="mt-2">
                <Field label="Description">
                  <TextInput value={row.description || ''} maxLength={72} onChange={(event) => updateOption('rows', index, { description: event.target.value.slice(0, 72) })} />
                </Field>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <TextInput value={row.id || ''} onChange={(event) => updateOption('rows', index, { id: toNodeId(event.target.value, `row_${index + 1}`) })} />
                <button type="button" onClick={() => removeOption('rows', index)} className="shell-button-secondary px-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {selectedNode.type === 'CONDITION' ? (
        <>
          <Field label="Field key">
            <TextInput value={data.fieldKey || ''} onChange={(event) => update({ fieldKey: toNodeId(event.target.value, 'answer') })} />
          </Field>
          <Field label="Operator">
            <select value={data.operator || 'EXISTS'} onChange={(event) => update({ operator: event.target.value })} className="shell-input-rect bg-white text-sm">
              <option value="EXISTS">Exists</option>
              <option value="EQUALS">Equals</option>
              <option value="NOT_EQUALS">Does not equal</option>
              <option value="CONTAINS">Contains</option>
            </select>
          </Field>
          <Field label="Value">
            <TextInput value={data.value || ''} onChange={(event) => update({ value: event.target.value.slice(0, 120) })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'CATALOG_LIST' ? (
        <>
          <Field label="Catalog">
            <select
              value={catalogType}
              onChange={(event) => update({ catalogType: event.target.value, itemOverrides: [] })}
              className="shell-input-rect bg-white text-sm"
            >
              {catalogTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Message body">
            <TextArea value={data.body || ''} onChange={(event) => update({ body: event.target.value.slice(0, 1024) })} />
          </Field>
          <Field label="List button label">
            <TextInput value={data.buttonLabel || ''} maxLength={20} onChange={(event) => update({ buttonLabel: event.target.value.slice(0, 20) })} />
          </Field>
          {['SERVICE', 'PACKAGE'].includes(catalogType) ? (
            <Field label="Category filter">
              <TextInput value={data.category || ''} onChange={(event) => update({ category: event.target.value.slice(0, 80) })} />
            </Field>
          ) : null}
          {catalogType === 'PACKAGE' ? (
            <Field label="Tour type filter">
              <TextInput value={data.tourType || ''} onChange={(event) => update({ tourType: event.target.value.slice(0, 80) })} />
            </Field>
          ) : null}
          {catalogType === 'PROPERTY' ? (
            <>
              <Field label="Property type">
                <select value={data.propertyType || ''} onChange={(event) => update({ propertyType: event.target.value })} className="shell-input-rect bg-white text-sm">
                  <option value="">Any type</option>
                  {propertyOptions.types.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="Location">
                <select value={data.propertyLocation || ''} onChange={(event) => update({ propertyLocation: event.target.value })} className="shell-input-rect bg-white text-sm">
                  <option value="">Any location</option>
                  {propertyOptions.locations.map((location) => <option key={location} value={location}>{location}</option>)}
                </select>
              </Field>
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={data.askLocationFirst === true}
                  onChange={(event) => update({ askLocationFirst: event.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-neutral-300"
                />
                <span>
                  <span className="block font-semibold text-neutral-800">Ask location first</span>
                  <span className="block text-xs text-neutral-500">Show available locations before listing matching properties.</span>
                </span>
              </label>
              {data.askLocationFirst === true ? (
                <>
                  <Field label="Location prompt">
                    <TextInput value={data.locationPrompt || ''} onChange={(event) => update({ locationPrompt: event.target.value.slice(0, 200) })} />
                  </Field>
                  <Field label="Location button">
                    <TextInput value={data.locationButtonLabel || ''} maxLength={20} onChange={(event) => update({ locationButtonLabel: event.target.value.slice(0, 20) })} />
                  </Field>
                </>
              ) : null}
            </>
          ) : null}
          {catalogType === 'VISA' ? (
            <>
              <Field label="Country filter">
                <TextInput value={data.country || ''} onChange={(event) => update({ country: event.target.value.slice(0, 80) })} />
              </Field>
              <Field label="Visa type filter">
                <TextInput value={data.visaType || ''} onChange={(event) => update({ visaType: event.target.value.slice(0, 80) })} />
              </Field>
            </>
          ) : null}
          {catalogType === 'CRUISE' ? (
            <>
              <Field label="Destination filter">
                <TextInput value={data.destination || ''} onChange={(event) => update({ destination: event.target.value.slice(0, 80) })} />
              </Field>
              <Field label="Cruise line filter">
                <TextInput value={data.cruiseLine || ''} onChange={(event) => update({ cruiseLine: event.target.value.slice(0, 80) })} />
              </Field>
            </>
          ) : null}
          <Field label="Empty message">
            <TextArea value={data.emptyMessage || ''} onChange={(event) => update({ emptyMessage: event.target.value.slice(0, 300) })} />
          </Field>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-neutral-500">Specific item routes</p>
              <p className="mt-1 text-xs text-neutral-500">Add only items that need a custom path. All others use the Default item connector.</p>
            </div>
            {(data.itemOverrides || []).map((item) => (
              <div key={item.itemId} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-800">{item.label || item.itemId}</p>
                  <p className="truncate text-xs text-neutral-500">{item.itemId}</p>
                </div>
                <button type="button" onClick={() => removeCatalogOverride(item.itemId)} className="shell-button-secondary px-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 p-2">
              {selectedCatalogItems.slice(0, 100).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addCatalogOverride(item)}
                  disabled={overrideIds.has(String(item.id))}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-50 disabled:cursor-default disabled:opacity-45"
                >
                  <span className="block truncate font-semibold text-neutral-800">{catalogItemLabel(item, catalogType)}</span>
                  <span className="block truncate text-xs text-neutral-500">{catalogItemMeta(item, catalogType) || item.id}</span>
                </button>
              ))}
              {!selectedCatalogItems.length ? <p className="px-2 py-3 text-xs text-neutral-500">No active catalog items loaded.</p> : null}
            </div>
          </div>
        </>
      ) : null}

      {selectedNode.type === 'SEARCH' ? (
        <>
          <Field label="Search in">
            <select
              value={catalogType}
              onChange={(event) => update({ catalogType: event.target.value, searchMappings: [] })}
              className="shell-input-rect bg-white text-sm"
            >
              {catalogTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Intro message">
            <TextArea value={data.body || ''} onChange={(event) => update({ body: event.target.value.slice(0, 1024) })} />
          </Field>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-neutral-500">Search by answers</p>
              <p className="mt-1 text-xs text-neutral-500">Map a Question&apos;s saved field to an inventory field. Typos are auto-corrected to the closest real value.</p>
            </div>
            {searchMappings.map((mapping, index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                <TextInput
                  placeholder="question field key"
                  value={mapping.fieldKey || ''}
                  onChange={(event) => updateSearchMapping(index, { fieldKey: event.target.value.slice(0, 60) })}
                />
                <span className="text-xs text-neutral-400">→</span>
                <select
                  value={mapping.matchField || ''}
                  onChange={(event) => updateSearchMapping(index, { matchField: event.target.value })}
                  className="shell-input-rect bg-white text-sm"
                >
                  <option value="">field…</option>
                  {searchFieldOptions(catalogType).map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
                <button type="button" onClick={() => removeSearchMapping(index)} className="shell-button-secondary px-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" onClick={addSearchMapping} className="shell-button-secondary text-sm">+ Add search field</button>
          </div>
          <Field label="Max results (1-10)">
            <TextInput
              type="number"
              min={1}
              max={10}
              value={data.maxResults ?? 6}
              onChange={(event) => update({ maxResults: Math.min(10, Math.max(1, parseInt(event.target.value, 10) || 6)) })}
            />
          </Field>
          <Field label="Pick prompt">
            <TextInput value={data.pickPrompt || ''} onChange={(event) => update({ pickPrompt: event.target.value.slice(0, 200) })} />
          </Field>
          <Field label="No-match message">
            <TextArea value={data.emptyMessage || ''} onChange={(event) => update({ emptyMessage: event.target.value.slice(0, 300) })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'WHATSAPP_BUTTON' ? (
        <>
          <Field label="Message body">
            <TextArea value={data.body || ''} onChange={(event) => update({ body: event.target.value.slice(0, 1024) })} />
          </Field>
          <Field label="Button label">
            <TextInput value={data.buttonLabel || ''} maxLength={20} onChange={(event) => update({ buttonLabel: event.target.value.slice(0, 20) })} />
          </Field>
          <Field label="Opens WhatsApp of">
            <select value={data.target || 'ASSIGNED_AGENT'} onChange={(event) => update({ target: event.target.value })} className="shell-input-rect bg-white text-sm">
              <option value="ASSIGNED_AGENT">Assigned staff member</option>
              <option value="CUSTOM">A specific number</option>
            </select>
          </Field>
          {data.target === 'CUSTOM' ? (
            <Field label="WhatsApp number (with country code)">
              <TextInput value={data.phone || ''} placeholder="e.g. +919876543210" onChange={(event) => update({ phone: event.target.value.slice(0, 20) })} />
            </Field>
          ) : null}
        </>
      ) : null}

      {selectedNode.type === 'SEND_ITEM_DETAIL' ? (
        <>
          <Field label="Catalog type">
            <select value={data.catalogType || 'AUTO'} onChange={(event) => update({ catalogType: event.target.value })} className="shell-input-rect bg-white text-sm">
              <option value="AUTO">Use selected item</option>
              {catalogTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Optional intro message">
            <TextArea value={data.message || ''} onChange={(event) => update({ message: event.target.value.slice(0, 1024) })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'SEND_ITEM_DOCUMENT' ? (
        <SendDocumentFields data={data} update={update} catalogTypes={catalogTypes} />
      ) : null}

      {selectedNode.type === 'SAVE_ENQUIRY' ? (
        <>
          <Field label="Notes prefix">
            <TextInput value={data.notePrefix || ''} onChange={(event) => update({ notePrefix: event.target.value.slice(0, 80) })} />
          </Field>
          <Field label="Final message">
            <TextArea value={data.finalMessage || ''} onChange={(event) => update({ finalMessage: event.target.value.slice(0, 1024) })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'NOTIFY_STAFF' ? (
        <Field label="Staff message">
          <TextArea value={data.staffMessage || ''} onChange={(event) => update({ staffMessage: event.target.value.slice(0, 1500) })} />
        </Field>
      ) : null}

      {selectedNode.type === 'OPEN_SERVICE' ? (
        <>
          <Field label="Service">
            <select value={data.serviceId || ''} onChange={(event) => update({ serviceId: event.target.value, serviceKey: '' })} className="shell-input-rect bg-white text-sm">
              <option value="">Use service key</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </Field>
          <Field label="Service key">
            <TextInput value={data.serviceKey || ''} onChange={(event) => update({ serviceKey: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_') })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'OPEN_PACKAGE_FLOW' ? (
        <>
          <Field label="Category">
            <TextInput value={data.category || ''} onChange={(event) => update({ category: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_') })} />
          </Field>
          <Field label="Tour type">
            <TextInput value={data.tourType || ''} onChange={(event) => update({ tourType: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_') })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'OPEN_PROPERTY_FLOW' ? (
        <>
          <Field label="Routing key">
            <TextInput value={data.routingIntentKey || ''} onChange={(event) => update({ routingIntentKey: toNodeId(event.target.value, 'staycations') })} />
          </Field>
          <Field label="Property type">
            <select value={data.propertyType || ''} onChange={(event) => update({ propertyType: event.target.value })} className="shell-input-rect bg-white text-sm">
              <option value="">Any type</option>
              {propertyOptions.types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <select value={data.propertyLocation || ''} onChange={(event) => update({ propertyLocation: event.target.value })} className="shell-input-rect bg-white text-sm">
              <option value="">Any location</option>
              {propertyOptions.locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'OPEN_VISA_FLOW' ? (
        <>
          <Field label="Country filter">
            <TextInput value={data.country || ''} onChange={(event) => update({ country: event.target.value })} />
          </Field>
          <Field label="Visa type filter">
            <TextInput value={data.visaType || ''} onChange={(event) => update({ visaType: event.target.value })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'OPEN_CRUISE_FLOW' ? (
        <>
          <Field label="Destination filter">
            <TextInput value={data.destination || ''} onChange={(event) => update({ destination: event.target.value })} />
          </Field>
          <Field label="Cruise line filter">
            <TextInput value={data.cruiseLine || ''} onChange={(event) => update({ cruiseLine: event.target.value })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'OPEN_SERVICE_FLOW' ? (
        <Field label="Category filter">
          <TextInput value={data.category || ''} onChange={(event) => update({ category: event.target.value })} />
        </Field>
      ) : null}

      {selectedNode.type === 'OPEN_META_FLOW' ? (
        <>
          <Field label="Published flow">
            <select value={data.flowId || ''} onChange={(event) => update({ flowId: event.target.value })} className="shell-input-rect bg-white text-sm">
              <option value="">Latest by type</option>
              {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
            </select>
          </Field>
          <Field label="Flow type fallback">
            <select value={data.flowType || 'GENERIC'} onChange={(event) => update({ flowType: event.target.value })} className="shell-input-rect bg-white text-sm">
              <option value="PACKAGE">Package</option>
              <option value="PROPERTY">Property</option>
              <option value="VISA">Visa</option>
              <option value="CRUISE">Cruise</option>
              <option value="SERVICE">Service</option>
              <option value="CUSTOM_TRIP">Custom Trip</option>
              <option value="REVIEW">Review</option>
              <option value="GENERIC">Generic</option>
            </select>
          </Field>
          <Field label="CTA">
            <TextInput value={data.cta || ''} maxLength={20} onChange={(event) => update({ cta: event.target.value.slice(0, 20) })} />
          </Field>
        </>
      ) : null}

      {selectedNode.type === 'HANDOFF' ? (
        <Field label="Reason">
          <TextArea value={data.reason || ''} onChange={(event) => update({ reason: event.target.value.slice(0, 180) })} />
        </Field>
      ) : null}

      {selectedNode.type === 'END' ? (
        <Field label="Final message">
          <TextArea value={data.message || ''} onChange={(event) => update({ message: event.target.value.slice(0, 1024) })} />
        </Field>
      ) : null}
    </div>
  );
}

// ---- Interactive WhatsApp preview engine ----
// Mirrors the bot's executeFlowGraphNode() in bot/src/handlers/travelFlowHandler.js
// so the preview navigates exactly like the live WhatsApp conversation.

function resolveEdgeTarget(edges, sourceId, handle = 'default') {
  const wanted = String(handle || 'default');
  const exact = edges.find((edge) => edge.source === sourceId && String(edge.sourceHandle || 'default').toLowerCase() === wanted.toLowerCase());
  if (exact) return exact.target;
  if (wanted !== 'default') {
    const fallback = edges.find((edge) => edge.source === sourceId && String(edge.sourceHandle || 'default').toLowerCase() === 'default');
    if (fallback) return fallback.target;
  }
  return null;
}

function renderFlowText(template, agency, fields = {}) {
  return String(template || '')
    .replace(/\{customerName\}/g, 'Ravi')
    .replace(/\{agencyName\}/g, agency?.name || 'Your Agency')
    .replace(/\{([^}]+)\}/g, (match, key) => {
      const normalizedKey = String(key).trim();
      return Object.prototype.hasOwnProperty.call(fields, normalizedKey) ? String(fields[normalizedKey]) : match;
    });
}

function evaluateCondition(data = {}, fields = {}) {
  const actual = String(fields[String(data.fieldKey || '').trim()] || '').trim();
  const expected = String(data.value || '').trim();
  const operator = String(data.operator || 'EXISTS').toUpperCase();
  if (operator === 'EQUALS') return actual.toLowerCase() === expected.toLowerCase();
  if (operator === 'NOT_EQUALS') return actual.toLowerCase() !== expected.toLowerCase();
  if (operator === 'CONTAINS') return actual.toLowerCase().includes(expected.toLowerCase());
  return Boolean(actual);
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  return Number.isFinite(num) ? `₹${num.toLocaleString('en-IN')}` : `₹${value}`;
}

function getPropertyLocationFieldKey(data = {}) {
  return String(data.propertyLocationField || data.locationFieldKey || 'propertyLocation').trim() || 'propertyLocation';
}

function getPreviewPropertyLocation(data = {}, fields = {}) {
  return String(data.propertyLocation || fields[getPropertyLocationFieldKey(data)] || '').trim();
}

function propertyLocationRows(items = []) {
  const groups = new Map();
  items.forEach((item) => {
    const location = String(item.location || '').trim();
    if (!location) return;
    const key = location.toLowerCase();
    const current = groups.get(key) || { id: location, title: location, count: 0 };
    current.count += 1;
    groups.set(key, current);
  });
  return [
    { id: 'ALL', title: 'All locations', description: 'Show every property' },
    ...Array.from(groups.values()).map((item) => ({
      id: item.id,
      title: item.title,
      description: `${item.count} propert${item.count === 1 ? 'y' : 'ies'}`,
    })),
  ].slice(0, 10);
}

function filterCatalogPreviewItems(items = [], catalogType, data = {}, fields = {}) {
  return items.filter((item) => {
    if (catalogType === 'SERVICE') return !data.category || String(item.category || '').toLowerCase() === String(data.category).toLowerCase();
    if (catalogType === 'PACKAGE') {
      return (!data.category || String(item.category || '').toLowerCase() === String(data.category).toLowerCase())
        && (!data.tourType || String(item.tourType || '').toLowerCase() === String(data.tourType).toLowerCase());
    }
    if (catalogType === 'PROPERTY') {
      const selectedLocation = getPreviewPropertyLocation(data, fields);
      return (!data.propertyType || item.propertyType === data.propertyType)
        && (!selectedLocation || selectedLocation === 'ALL' || item.location === selectedLocation);
    }
    if (catalogType === 'VISA') {
      return (!data.country || String(item.country || '').toLowerCase().includes(String(data.country).toLowerCase()))
        && (!data.visaType || String(item.visaType || '').toLowerCase() === String(data.visaType).toLowerCase());
    }
    if (catalogType === 'CRUISE') {
      return (!data.destination || (Array.isArray(item.destinations) ? item.destinations : []).join(' ').toLowerCase().includes(String(data.destination).toLowerCase()))
        && (!data.cruiseLine || String(item.cruiseLine || '').toLowerCase().includes(String(data.cruiseLine).toLowerCase()));
    }
    return true;
  });
}

function previewCatalogDescription(item, catalogType) {
  const meta = catalogItemMeta(item, catalogType);
  if (meta) return meta;
  if (catalogType === 'PACKAGE') return [item.duration, formatPrice(item.basePrice)].filter(Boolean).join(' - ');
  if (catalogType === 'PROPERTY') return [item.location, item.pricePerNight ? `${formatPrice(item.pricePerNight)}/night` : ''].filter(Boolean).join(' - ');
  return '';
}

function Preview({ nodes, edges, agency, properties = [], flows = [], catalogItems = {} }) {
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const start = useMemo(() => nodes.find((node) => node.type === 'START'), [nodes]);

  const [items, setItems] = useState([]);
  const [awaiting, setAwaiting] = useState(null); // { nodeId, type }
  const [ended, setEnded] = useState(false);
  const [listSheet, setListSheet] = useState(null);
  const [input, setInput] = useState('');

  const fieldsRef = useRef({});
  const selectedItemRef = useRef(null);
  const catalogCacheRef = useRef(new Map());
  const runSeq = useRef(0);
  const chatRef = useRef(null);

  const push = useCallback((item) => setItems((prev) => [...prev, item]), []);

  const fetchCatalog = useCallback(async (kind, api, params = {}) => {
    const key = `${kind}|${JSON.stringify(params)}`;
    if (catalogCacheRef.current.has(key)) return catalogCacheRef.current.get(key);
    try {
      const res = await api.list({ active: true, ...params });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : [];
      catalogCacheRef.current.set(key, list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const run = useCallback(async (startNodeId, seq) => {
    let current = startNodeId;
    const guard = new Set();
    while (current && !guard.has(current)) {
      if (seq !== runSeq.current) return; // a restart superseded this run
      guard.add(current);
      const node = byId.get(current);
      if (!node) { setEnded(true); return; }
      const data = node.data || {};
      const fields = fieldsRef.current;

      if (node.type === 'START') { current = resolveEdgeTarget(edges, node.id, 'default'); continue; }

      if (node.type === 'MESSAGE') {
        const body = renderFlowText(data.body || data.message, agency, fields);
        if (body) push({ from: 'bot', text: body });
        current = resolveEdgeTarget(edges, node.id, 'default');
        continue;
      }

      if (node.type === 'CONDITION') {
        const matched = evaluateCondition(data, fields);
        current = resolveEdgeTarget(edges, node.id, matched ? 'true' : 'false') || resolveEdgeTarget(edges, node.id, 'default');
        continue;
      }

      if (node.type === 'QUESTION') {
        push({ from: 'bot', text: renderFlowText(data.prompt || 'Please share the details.', agency, fields) });
        setAwaiting({ nodeId: node.id, type: 'QUESTION' });
        return;
      }

      if (node.type === 'BUTTONS') {
        push({ from: 'bot', kind: 'buttons', text: renderFlowText(data.body || 'Please choose an option.', agency, fields), nodeId: node.id, options: (data.buttons || []).slice(0, 3) });
        setAwaiting({ nodeId: node.id, type: 'BUTTONS' });
        return;
      }

      if (node.type === 'LIST') {
        push({ from: 'bot', kind: 'list', text: renderFlowText(data.body || 'Please choose an option.', agency, fields), nodeId: node.id, buttonLabel: data.buttonLabel || 'Choose', title: data.title || 'Options', rows: (data.rows || []).slice(0, 10) });
        setAwaiting({ nodeId: node.id, type: 'LIST' });
        return;
      }

      if (node.type === 'CATALOG_LIST') {
        const catalogType = data.catalogType || 'SERVICE';
        const sourceItems = getCatalogItemsForType(catalogItems, catalogType);
        const shouldAskLocation = catalogType === 'PROPERTY'
          && data.askLocationFirst === true
          && !data.propertyLocation
          && !fields[getPropertyLocationFieldKey(data)];
        if (shouldAskLocation) {
          const locationRows = propertyLocationRows(sourceItems.filter((item) => !data.propertyType || item.propertyType === data.propertyType));
          if (locationRows.length > 1) {
            push({
              from: 'bot',
              kind: 'property_locations',
              text: renderFlowText(data.locationPrompt || 'Which location are you interested in?', agency, fields),
              nodeId: node.id,
              buttonLabel: data.locationButtonLabel || 'Choose Location',
              title: 'Locations',
              rows: locationRows,
              fieldKey: getPropertyLocationFieldKey(data),
            });
            setAwaiting({ nodeId: node.id, type: 'PROPERTY_LOCATION_LIST' });
            return;
          }
        }
        const filtered = filterCatalogPreviewItems(sourceItems, catalogType, data, fields).slice(0, 10);
        if (!filtered.length) {
          const emptyMessage = renderFlowText(data.emptyMessage || 'No active options are available right now.', agency, fields);
          if (emptyMessage) push({ from: 'bot', text: emptyMessage });
          current = resolveEdgeTarget(edges, node.id, 'empty');
          if (current) continue;
          setEnded(true);
          return;
        }
        push({
          from: 'bot',
          kind: 'catalog',
          text: renderFlowText(data.body || 'Please choose an option.', agency, fields),
          nodeId: node.id,
          catalogType,
          buttonLabel: data.buttonLabel || 'View Options',
          title: CATALOG_TYPES.find(([value]) => value === catalogType)?.[1] || 'Options',
          rows: filtered.map((item) => ({
            id: String(item.id),
            title: catalogItemLabel(item, catalogType).slice(0, 24),
            description: previewCatalogDescription(item, catalogType).slice(0, 72),
            raw: item,
          })),
        });
        setAwaiting({ nodeId: node.id, type: 'CATALOG_LIST' });
        return;
      }

      if (node.type === 'SEARCH') {
        const catalogType = data.catalogType || 'PROPERTY';
        const mappings = (data.searchMappings || []).filter((m) => m && m.fieldKey && m.matchField);
        const items = getCatalogItemsForType(catalogItems, catalogType);
        const maxResults = Math.min(Math.max(parseInt(data.maxResults, 10) || 6, 1), 10);
        // Preview uses a simple contains match; the live bot adds typo-tolerant correction.
        const filtered = items.filter((item) => mappings.every((mapping) => {
          const answer = String(fields[mapping.fieldKey] || '').trim().toLowerCase();
          if (!answer) return true;
          const field = mapping.matchField === 'destination' ? 'destinations' : mapping.matchField;
          const raw = item[field];
          const values = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
          return values.some((value) => {
            const candidate = String(value).toLowerCase();
            return candidate.includes(answer) || answer.includes(candidate);
          });
        })).slice(0, maxResults);
        if (!filtered.length) {
          const emptyMessage = renderFlowText(data.emptyMessage || 'Sorry, I could not find a match for that.', agency, fields);
          if (emptyMessage) push({ from: 'bot', text: emptyMessage });
          current = resolveEdgeTarget(edges, node.id, 'empty');
          if (current) continue;
          setEnded(true);
          return;
        }
        push({
          from: 'bot',
          kind: 'catalog',
          text: renderFlowText(data.body || 'Here are the closest matches:', agency, fields),
          nodeId: node.id,
          catalogType,
          buttonLabel: 'Select',
          title: 'Results',
          rows: filtered.map((item, index) => ({
            id: String(item.id),
            title: `${index + 1}. ${catalogItemLabel(item, catalogType)}`.slice(0, 24),
            description: previewCatalogDescription(item, catalogType).slice(0, 72),
            raw: item,
          })),
        });
        setAwaiting({ nodeId: node.id, type: 'CATALOG_LIST' });
        return;
      }

      if (node.type === 'WHATSAPP_BUTTON') {
        push({
          from: 'bot',
          kind: 'flowcard',
          text: renderFlowText(data.body || 'Tap below to chat with us on WhatsApp.', agency, fields),
          title: data.target === 'CUSTOM' ? (data.phone || 'WhatsApp') : 'Assigned staff',
          cta: data.buttonLabel || 'Chat on WhatsApp',
        });
        current = resolveEdgeTarget(edges, node.id, 'default');
        if (current) continue;
        setEnded(true);
        return;
      }

      if (node.type === 'OPEN_PACKAGE_FLOW') {
        const category = data.category || 'DOMESTIC';
        const params = {};
        if (data.category) params.category = data.category;
        if (data.tourType) params.tourType = data.tourType;
        push({ from: 'bot', text: `Here are our ${String(category).toLowerCase()} packages${data.tourType ? ` · ${data.tourType}` : ''}:` });
        const list = await fetchCatalog('package', packagesApi, params);
        if (seq !== runSeq.current) return;
        if (list.length) {
          push({ from: 'bot', kind: 'list', readonly: true, text: 'Select a package to view details.', buttonLabel: 'View Packages', title: 'Packages', rows: list.slice(0, 10).map((p) => ({ id: String(p.id), title: p.name, description: [p.duration, formatPrice(p.basePrice)].filter(Boolean).join(' · ') })) });
        } else {
          push({ from: 'bot', text: 'No matching packages are published yet.' });
        }
        setEnded(true);
        return;
      }

      if (node.type === 'OPEN_VISA_FLOW') {
        push({ from: 'bot', text: 'Here are our visa services:' });
        const all = await fetchCatalog('visa', visasApi, {});
        if (seq !== runSeq.current) return;
        const list = all.filter((v) =>
          (!data.country || String(v.country || '').toLowerCase().includes(String(data.country).toLowerCase()))
          && (!data.visaType || String(v.visaType || '').toLowerCase() === String(data.visaType).toLowerCase()));
        if (list.length) {
          push({ from: 'bot', kind: 'list', readonly: true, text: 'Select a visa to view details.', buttonLabel: 'View Visas', title: 'Visas', rows: list.slice(0, 10).map((v) => ({ id: String(v.id), title: [v.country, v.visaType].filter(Boolean).join(' · ') || 'Visa', description: [v.processingTime, v.price ? formatPrice(v.price / 100) : ''].filter(Boolean).join(' · ') })) });
        } else {
          push({ from: 'bot', text: 'No matching visa services are published yet.' });
        }
        setEnded(true);
        return;
      }

      if (node.type === 'OPEN_CRUISE_FLOW') {
        push({ from: 'bot', text: 'Here are our cruise holidays:' });
        const all = await fetchCatalog('cruise', cruisesApi, {});
        if (seq !== runSeq.current) return;
        const list = all.filter((c) =>
          (!data.destination || (Array.isArray(c.destinations) ? c.destinations : []).join(' ').toLowerCase().includes(String(data.destination).toLowerCase()))
          && (!data.cruiseLine || String(c.cruiseLine || '').toLowerCase().includes(String(data.cruiseLine).toLowerCase())));
        if (list.length) {
          push({ from: 'bot', kind: 'list', readonly: true, text: 'Select a cruise to view details.', buttonLabel: 'View Cruises', title: 'Cruises', rows: list.slice(0, 10).map((c) => ({ id: String(c.id), title: c.name, description: [c.duration, c.basePrice ? formatPrice(c.basePrice / 100) : ''].filter(Boolean).join(' · ') })) });
        } else {
          push({ from: 'bot', text: 'No matching cruises are published yet.' });
        }
        setEnded(true);
        return;
      }

      if (node.type === 'OPEN_SERVICE_FLOW') {
        push({ from: 'bot', text: 'Here are our services:' });
        const all = await fetchCatalog('service', servicesApi, {});
        if (seq !== runSeq.current) return;
        const list = all.filter((s) => !data.category || String(s.category || '').toLowerCase() === String(data.category).toLowerCase());
        if (list.length) {
          push({ from: 'bot', kind: 'list', readonly: true, text: 'Select a service to view details.', buttonLabel: 'View Services', title: 'Services', rows: list.slice(0, 10).map((s) => ({ id: String(s.id), title: s.name, description: String(s.category || s.description || '') })) });
        } else {
          push({ from: 'bot', text: 'No matching services are published yet.' });
        }
        setEnded(true);
        return;
      }

      if (node.type === 'OPEN_PROPERTY_FLOW') {
        const filtered = properties.filter((p) =>
          (!data.propertyType || p.propertyType === data.propertyType)
          && (!data.propertyLocation || p.location === data.propertyLocation));
        push({ from: 'bot', text: 'Here are our available stays:' });
        if (filtered.length) {
          push({ from: 'bot', kind: 'list', readonly: true, text: 'Select a property to view details.', buttonLabel: 'View Stays', title: 'Properties', rows: filtered.slice(0, 10).map((p) => ({ id: String(p.id), title: p.name, description: [p.location, p.pricePerNight ? `${formatPrice(p.pricePerNight)}/night` : ''].filter(Boolean).join(' · ') })) });
        } else {
          push({ from: 'bot', text: 'No matching stays are published yet.' });
        }
        setEnded(true);
        return;
      }

      if (node.type === 'OPEN_META_FLOW') {
        const flow = flows.find((f) => String(f.id) === String(data.flowId));
        push({ from: 'bot', kind: 'flowcard', text: renderFlowText(data.body || 'Please complete the form below.', agency, fields), title: flow?.name || 'WhatsApp Form', cta: data.cta || 'Open Form' });
        setEnded(true);
        return;
      }

      if (node.type === 'SEND_ITEM_DETAIL') {
        const item = selectedItemRef.current;
        if (data.message) push({ from: 'bot', text: renderFlowText(data.message, agency, fields) });
        if (item) {
          push({ from: 'bot', text: `${item.catalogType}: ${catalogItemLabel(item.raw, item.catalogType)}\n${previewCatalogDescription(item.raw, item.catalogType)}` });
        } else {
          push({ from: 'bot', text: 'No catalog item has been selected yet.' });
        }
        const target = resolveEdgeTarget(edges, node.id, 'default');
        if (target) { current = target; continue; }
        setEnded(true);
        return;
      }

      if (node.type === 'SEND_ITEM_DOCUMENT') {
        const item = selectedItemRef.current;
        if (item?.catalogType === 'PACKAGE' && item.raw?.brochureUrl) {
          push({ from: 'bot', text: `PDF would be sent for ${catalogItemLabel(item.raw, item.catalogType)}.` });
        } else {
          push({ from: 'bot', text: data.fallbackMessage || 'The PDF is not available yet. Our team will share it shortly.' });
        }
        const target = resolveEdgeTarget(edges, node.id, 'default');
        if (target) { current = target; continue; }
        setEnded(true);
        return;
      }

      if (node.type === 'SAVE_ENQUIRY') {
        push({ from: 'system', text: 'Lead enquiry would be saved with the captured answers.' });
        if (data.finalMessage) push({ from: 'bot', text: renderFlowText(data.finalMessage, agency, fields) });
        const target = resolveEdgeTarget(edges, node.id, 'default');
        if (target) { current = target; continue; }
        setEnded(true);
        return;
      }

      if (node.type === 'NOTIFY_STAFF') {
        push({ from: 'system', text: 'Assigned staff would receive this message:' });
        push({
          from: 'bot',
          text: renderFlowText(data.staffMessage || '', agency, fields)
            .replace(/\{customerPhone\}/g, '+919999999999')
            .replace(/\{packageName\}/g, fields.packageName || 'Selected enquiry'),
        });
        const target = resolveEdgeTarget(edges, node.id, 'default');
        if (target) { current = target; continue; }
        setEnded(true);
        return;
      }

      if (node.type === 'OPEN_SERVICE') {
        const label = data.serviceKey || data.serviceCategory || 'service';
        push({ from: 'bot', text: `Please share your ${String(label).toLowerCase()} requirement and our team will assist you.` });
        setEnded(true);
        return;
      }

      if (node.type === 'OPEN_CUSTOM_TRIP_FLOW') {
        push({ from: 'bot', text: 'Let us plan your custom trip! Share your destination, dates and number of travellers.' });
        setEnded(true);
        return;
      }

      if (node.type === 'HANDOFF') {
        push({ from: 'system', text: 'You are now connected with our team. An agent will reply shortly.' });
        setEnded(true);
        return;
      }

      if (node.type === 'END') {
        const message = renderFlowText(data.message || data.body, agency, fields);
        if (message) push({ from: 'bot', text: message });
        setEnded(true);
        return;
      }

      current = resolveEdgeTarget(edges, node.id, 'default');
    }
    setEnded(true);
  }, [agency, byId, catalogItems, edges, fetchCatalog, flows, properties, push]);

  const restart = useCallback(() => {
    const seq = runSeq.current + 1;
    runSeq.current = seq;
    fieldsRef.current = {};
    selectedItemRef.current = null;
    setItems([]);
    setAwaiting(null);
    setEnded(false);
    setListSheet(null);
    setInput('');
    if (!start) {
      setItems([{ from: 'system', text: 'Add a Start node to preview the flow.' }]);
      setEnded(true);
      return;
    }
    const first = resolveEdgeTarget(edges, start.id, 'default');
    if (!first) {
      setItems([{ from: 'system', text: 'Connect Start to a message to preview the flow.' }]);
      setEnded(true);
      return;
    }
    run(first, seq);
  }, [edges, run, start]);

  // Start the simulation once on mount; thereafter the user drives it with Restart.
  useEffect(() => { restart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [items, listSheet]);

  const chooseOption = useCallback((item, option) => {
    if (ended) return;
    push({ from: 'me', text: option.label || option.title });
    setAwaiting(null);
    setListSheet(null);
    const target = resolveEdgeTarget(edges, item.nodeId, option.id);
    if (target) run(target, runSeq.current);
    else {
      push({ from: 'system', text: 'This option is not connected to anything yet.' });
      setEnded(true);
    }
  }, [edges, ended, push, run]);

  const pickRow = useCallback((item, row) => {
    setListSheet(null);
    if (item.kind === 'property_locations') {
      push({ from: 'me', text: row.title });
      fieldsRef.current = {
        ...fieldsRef.current,
        [item.fieldKey || 'propertyLocation']: row.id,
        selectedPropertyLocation: row.id,
      };
      setAwaiting(null);
      run(item.nodeId, runSeq.current);
      return;
    }
    if (item.kind === 'catalog') {
      push({ from: 'me', text: row.title });
      selectedItemRef.current = { catalogType: item.catalogType, itemId: row.id, raw: row.raw };
      fieldsRef.current = {
        ...fieldsRef.current,
        selectedItemType: item.catalogType,
        selectedItemId: row.id,
        selectedItemName: row.title,
      };
      setAwaiting(null);
      const overrideTarget = resolveEdgeTarget(edges, item.nodeId, catalogHandle(item.catalogType, row.id));
      const defaultTarget = resolveEdgeTarget(edges, item.nodeId, 'selected');
      const target = overrideTarget || defaultTarget;
      if (target) run(target, runSeq.current);
      else {
        push({ from: 'system', text: 'This catalog selection is not connected to anything yet.' });
        setEnded(true);
      }
      return;
    }
    if (item.readonly) {
      push({ from: 'me', text: row.title });
      push({ from: 'bot', text: 'Great choice! Our team will share full details and pricing shortly.' });
      return;
    }
    chooseOption(item, row);
  }, [chooseOption, edges, push, run]);

  const submitQuestion = useCallback(() => {
    if (!awaiting || awaiting.type !== 'QUESTION' || ended) return;
    const text = input.trim();
    if (!text) return;
    const node = byId.get(awaiting.nodeId);
    const fieldKey = String(node?.data?.fieldKey || node?.id || 'answer').trim();
    fieldsRef.current = { ...fieldsRef.current, [fieldKey]: text };
    push({ from: 'me', text });
    setInput('');
    setAwaiting(null);
    const target = resolveEdgeTarget(edges, awaiting.nodeId, 'default');
    if (target) run(target, runSeq.current);
    else setEnded(true);
  }, [awaiting, byId, edges, ended, input, push, run]);

  const agencyName = agency?.name || 'WhatsApp CRM';
  const isQuestion = awaiting?.type === 'QUESTION' && !ended;

  return (
    <div className="overflow-hidden rounded-[28px] border-[8px] border-neutral-900 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 bg-[#008069] px-3 py-2 text-white">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-sm font-bold">
          {agencyName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{agencyName}</p>
          <p className="text-[10px] leading-tight text-white/80">online</p>
        </div>
        <button type="button" onClick={restart} title="Restart preview" className="rounded-full p-1.5 hover:bg-white/15">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Chat */}
      <div className="relative bg-[#efeae2]">
        <div ref={chatRef} className="max-h-[460px] min-h-[360px] space-y-2 overflow-y-auto px-3 py-3">
          {items.map((item, index) => {
            if (item.from === 'system') {
              return (
                <div key={index} className="flex justify-center">
                  <span className="rounded-md bg-[#ffeecf] px-2.5 py-1 text-center text-[11px] font-medium text-neutral-600 shadow-sm">{item.text}</span>
                </div>
              );
            }
            const mine = item.from === 'me';
            return (
              <div key={index} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] flex-col ${mine ? 'items-end' : 'items-start'} gap-1`}>
                  <div className={`rounded-lg px-2.5 py-1.5 text-sm shadow-sm ${mine ? 'rounded-tr-none bg-[#d9fdd3] text-neutral-800' : 'rounded-tl-none bg-white text-neutral-800'}`}>
                    <p className="whitespace-pre-line leading-snug">{item.text}</p>
                    <span className="mt-0.5 block text-right text-[9px] text-neutral-400">12:30</span>
                  </div>

                  {item.kind === 'buttons' ? (
                    <div className="w-full space-y-1">
                      {item.options.map((option) => {
                        const active = awaiting?.nodeId === item.nodeId && !ended;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={!active}
                            onClick={() => chooseOption(item, option)}
                            className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold shadow-sm transition ${active ? 'text-[#00A884] hover:bg-emerald-50' : 'cursor-default text-neutral-300'}`}
                          >
                            <CornerUpLeft className="h-3.5 w-3.5" /> {option.label || option.title || option.id}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {item.kind === 'list' || item.kind === 'catalog' || item.kind === 'property_locations' ? (
                    <button
                      type="button"
                      disabled={!(item.readonly || item.kind === 'catalog' || item.kind === 'property_locations' || (awaiting?.nodeId === item.nodeId && !ended))}
                      onClick={() => setListSheet(item)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#00A884] shadow-sm transition hover:bg-emerald-50 disabled:cursor-default disabled:text-neutral-300"
                    >
                      <List className="h-4 w-4" /> {item.buttonLabel || 'Choose'}
                    </button>
                  ) : null}

                  {item.kind === 'flowcard' ? (
                    <div className="w-full overflow-hidden rounded-lg bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => push({ from: 'system', text: 'The WhatsApp form would open here.' })}
                        className="flex w-full items-center justify-center gap-1.5 border-t border-neutral-100 px-3 py-2 text-sm font-semibold text-[#00A884] hover:bg-emerald-50"
                      >
                        <Square className="h-3.5 w-3.5" /> {item.cta}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* List bottom sheet */}
        {listSheet ? (
          <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/30" onClick={() => setListSheet(null)}>
            <div className="max-h-[80%] overflow-y-auto rounded-t-2xl bg-white p-3" onClick={(event) => event.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-neutral-800">{listSheet.title || 'Options'}</span>
                <button type="button" onClick={() => setListSheet(null)} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="divide-y divide-neutral-100">
                {listSheet.rows.map((row) => (
                  <button key={row.id} type="button" onClick={() => pickRow(listSheet, row)} className="block w-full px-1 py-2 text-left hover:bg-neutral-50">
                    <p className="text-sm font-semibold text-neutral-800">{row.title}</p>
                    {row.description ? <p className="text-xs text-neutral-500">{row.description}</p> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 bg-[#f0f0f0] px-2 py-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') submitQuestion(); }}
          disabled={!isQuestion}
          placeholder={ended ? 'Conversation ended — tap ↻ to restart' : isQuestion ? 'Type a message' : 'Tap an option above'}
          className="min-w-0 flex-1 rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
        />
        <button type="button" onClick={submitQuestion} disabled={!isQuestion} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white disabled:bg-neutral-300">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function SettingsFlowBuilder({ fullScreen = false, initialFlowId = null, initialButtons = null }) {
  const { agency, updateAgency } = useAuthStore();
  const initialLibrary = useMemo(() => flowLibraryFromAgencyConfig(agency?.whatsappFlowConfig || {}), [agency?.whatsappFlowConfig]);
  // When opened from a campaign button binding, jump straight to that flow
  // instead of the default entry flow. The ref persists the desired flow so the
  // freshAgency re-sync below doesn't reset us back to the entry flow on load.
  const targetFlowIdRef = useRef(initialFlowId || null);
  const seedFlowId = (initialFlowId && initialLibrary.flows.some((flow) => flow.id === initialFlowId))
    ? initialFlowId
    : initialLibrary.entryFlowId;
  const [flowLibrary, setFlowLibrary] = useState(initialLibrary.flows);
  const [entryFlowId, setEntryFlowId] = useState(initialLibrary.entryFlowId);
  const [activeFlowId, setActiveFlowId] = useState(seedFlowId);
  const initialActiveFlow = initialLibrary.flows.find((flow) => flow.id === seedFlowId) || initialLibrary.flows[0] || graphToEditableFlow(DEFAULT_GRAPH, 'entry', 'Entry Menu');
  const [nodes, setNodes, onNodesChange] = useNodesState(asReactNodes(initialActiveFlow));
  const [edges, setEdges, onEdgesChange] = useEdgesState(asReactEdges(initialActiveFlow));
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const loadedConfigSignatureRef = useRef(JSON.stringify(agency?.whatsappFlowConfig || {}));

  const { data: freshAgency } = useQuery({
    queryKey: ['agency', 'flow-builder'],
    queryFn: () => client.get('/agencies/me').then((res) => res.data.data),
  });
  const { data: servicesData } = useQuery({ queryKey: ['services', 'flow-builder'], queryFn: () => servicesApi.list({ active: true }) });
  const { data: packagesData } = useQuery({ queryKey: ['packages', 'flow-builder'], queryFn: () => packagesApi.list({ active: true }) });
  const { data: propertiesData } = useQuery({ queryKey: ['properties', 'flow-builder'], queryFn: () => propertiesApi.list({ active: true }) });
  const { data: visasData } = useQuery({ queryKey: ['visas', 'flow-builder'], queryFn: () => visasApi.list({ active: true }) });
  const { data: cruisesData } = useQuery({ queryKey: ['cruises', 'flow-builder'], queryFn: () => cruisesApi.list({ active: true }) });
  const { data: flowsData } = useQuery({ queryKey: ['flows', 'flow-builder'], queryFn: () => flowsApi.list({ status: 'PUBLISHED' }) });

  const services = extractList(servicesData);
  const packages = extractList(packagesData);
  const properties = extractList(propertiesData);
  const visas = extractList(visasData);
  const cruises = extractList(cruisesData);
  const flows = extractList(flowsData);
  const catalogItems = useMemo(() => ({
    SERVICE: services,
    PACKAGE: packages,
    PROPERTY: properties,
    VISA: visas,
    CRUISE: cruises,
  }), [cruises, packages, properties, services, visas]);
  const propertyOptions = useMemo(() => ({
    types: [...new Set(properties.map((item) => item.propertyType).filter(Boolean))],
    locations: [...new Set(properties.map((item) => item.location).filter(Boolean))],
  }), [properties]);

  const enabledPrefs = agency?.sidebarPreferences;
  const moduleEnabled = useCallback((path) => isModuleEnabled(enabledPrefs, path), [enabledPrefs]);
  const visibleFlowLibrary = useMemo(
    () => flowLibrary.filter((flow) => moduleEnabled(DOMAIN_FLOW_MODULE[flow.id])),
    [flowLibrary, moduleEnabled],
  );
  const visibleNodeTypes = useMemo(
    () => NODE_TYPES.filter(([type]) => moduleEnabled(NODE_TYPE_MODULE[type])),
    [moduleEnabled],
  );
  const visibleCatalogTypes = useMemo(
    () => CATALOG_TYPES.filter(([value]) => moduleEnabled(CATALOG_TYPE_MODULE[value])),
    [moduleEnabled],
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const validationIssues = useMemo(() => validateGraph(nodes, edges), [nodes, edges]);
  const activeFlow = flowLibrary.find((flow) => flow.id === activeFlowId) || flowLibrary[0] || initialActiveFlow;

  useEffect(() => {
    if (freshAgency) updateAgency(freshAgency);
  }, [freshAgency, updateAgency]);

  useEffect(() => {
    const configSignature = JSON.stringify(agency?.whatsappFlowConfig || {});
    if (configSignature === loadedConfigSignatureRef.current) return;

    const nextLibrary = flowLibraryFromAgencyConfig(agency?.whatsappFlowConfig || {});
    const desiredId = targetFlowIdRef.current;
    const nextActiveFlow = (desiredId && nextLibrary.flows.find((flow) => flow.id === desiredId))
      || nextLibrary.flows.find((flow) => flow.id === nextLibrary.entryFlowId)
      || nextLibrary.flows[0]
      || graphToEditableFlow(DEFAULT_GRAPH, 'entry', 'Entry Menu');

    loadedConfigSignatureRef.current = configSignature;
    setFlowLibrary(nextLibrary.flows);
    setEntryFlowId(nextLibrary.entryFlowId);
    setActiveFlowId(nextActiveFlow.id);
    setNodes(asReactNodes(nextActiveFlow));
    setEdges(asReactEdges(nextActiveFlow));
    setSelectedNodeId(null);
    setHistory([]);
    setFuture([]);
  }, [agency?.whatsappFlowConfig, setEdges, setNodes]);

  // Seed a brand-new campaign flow from the approved template's buttons the first
  // time the builder is opened for it (one entry node per button). If the flow
  // already exists we just activate it.
  const seededButtonsRef = useRef(false);
  useEffect(() => {
    if (seededButtonsRef.current) return;
    if (!initialFlowId || !Array.isArray(initialButtons) || initialButtons.length === 0) return;
    seededButtonsRef.current = true;
    if (flowLibrary.some((flow) => flow.id === initialFlowId)) return;
    const seed = graphToEditableFlow(
      buildButtonSeedFlow(initialFlowId, 'Campaign flow', initialButtons),
      initialFlowId,
      'Campaign flow',
    );
    targetFlowIdRef.current = initialFlowId;
    setFlowLibrary((prev) => [seed, ...prev.filter((flow) => flow.id !== initialFlowId)]);
    setActiveFlowId(initialFlowId);
    setNodes(asReactNodes(seed));
    setEdges(asReactEdges(seed));
    setSelectedNodeId(null);
  }, [initialFlowId, initialButtons, flowLibrary, setNodes, setEdges]);

  const mergeActiveFlow = useCallback((nextNodes = nodes, nextEdges = edges) => (
    flowLibrary.map((flow) => (
      flow.id === activeFlowId
        ? graphPayloadFromState(flow, nextNodes, nextEdges)
        : flow
    ))
  ), [activeFlowId, edges, flowLibrary, nodes]);

  const selectFlow = (flowId) => {
    if (flowId === activeFlowId) return;
    const merged = mergeActiveFlow();
    const nextFlow = merged.find((flow) => flow.id === flowId);
    if (!nextFlow) return;
    targetFlowIdRef.current = flowId; // keep this flow active across config re-syncs
    setFlowLibrary(merged);
    setActiveFlowId(flowId);
    setNodes(asReactNodes(nextFlow));
    setEdges(asReactEdges(nextFlow));
    setSelectedNodeId(null);
    setHistory([]);
    setFuture([]);
  };

  const addFlowFromTemplate = (template) => {
    const merged = mergeActiveFlow();
    const existingIds = new Set(merged.map((flow) => flow.id));
    let id = template.id;
    let suffix = 2;
    while (existingIds.has(id)) { id = `${template.id}_${suffix}`; suffix += 1; }
    const newFlow = cloneTemplateFlow(template, id);
    setFlowLibrary([...merged, newFlow]);
    setActiveFlowId(id);
    setNodes(asReactNodes(newFlow));
    setEdges(asReactEdges(newFlow));
    setSelectedNodeId(null);
    setHistory([]);
    setFuture([]);
  };

  const snapshot = useCallback(() => {
    setHistory((items) => [...items.slice(-19), { nodes, edges }]);
    setFuture([]);
  }, [edges, nodes]);

  const addNode = (type) => {
    snapshot();
    const id = toNodeId(`${type}_${nodes.length + 1}`);
    setNodes((items) => [
      ...items,
      {
        id,
        type,
        position: { x: 260 + (nodes.length % 4) * 120, y: 120 + nodes.length * 20 },
        data: getDefaultNodeData(type),
      },
    ]);
    setSelectedNodeId(id);
  };

  const updateNodeData = (nodeId, patch) => {
    setNodes((items) => items.map((node) => node.id === nodeId ? { ...node, data: { ...(node.data || {}), ...patch } } : node));
  };

  const deleteSelected = () => {
    if (!selectedNode || selectedNode.type === 'START') return;
    snapshot();
    setNodes((items) => items.filter((node) => node.id !== selectedNode.id));
    setEdges((items) => items.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNodeId(null);
  };

  const onConnect = useCallback((connection) => {
    snapshot();
    setEdges((items) => addEdge({
      ...connection,
      id: `${connection.source}_${connection.sourceHandle || 'default'}_${connection.target}`,
      sourceHandle: connection.sourceHandle || 'default',
    }, items.filter((edge) => !(edge.source === connection.source && (edge.sourceHandle || 'default') === (connection.sourceHandle || 'default')))));
  }, [setEdges, snapshot]);

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((items) => [{ nodes, edges }, ...items]);
    setHistory((items) => items.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, { nodes, edges }]);
    setFuture((items) => items.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  const saveMutation = useMutation({
    mutationFn: (payload) => client.patch('/agencies/me', payload),
    onSuccess: ({ data: response }) => {
      updateAgency(response.data);
      toast.success('WhatsApp flow builder saved');
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message || 'Failed to save flow builder'),
  });

  const save = () => {
    const flowsToSave = mergeActiveFlow();
    const invalidFlow = flowsToSave.find((flow) => validateGraph(asReactNodes(flow), asReactEdges(flow)).length > 0);
    if (invalidFlow) {
      toast.error('Fix validation issues before saving');
      if (invalidFlow.id !== activeFlowId) selectFlow(invalidFlow.id);
      return;
    }
    saveMutation.mutate({
      whatsappFlowConfig: {
        schemaVersion: 4,
        entryFlowId,
        flows: flowsToSave,
      },
    });
    setFlowLibrary(flowsToSave);
  };

  return (
    <>
      {/* The drag-and-drop canvas needs a wide screen, so block the builder on phones. */}
      <div className={`md:hidden ${fullScreen ? "-m-3 min-h-[calc(100dvh-4rem)] bg-[#f5f5f5] p-3 sm:-m-4 sm:p-4" : ""}`}>
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            <Monitor className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-extrabold text-neutral-950">Open on a larger screen</h2>
          <p className="text-sm text-neutral-500">
            The WhatsApp Flow Builder is a drag-and-drop canvas designed for laptops and desktops. Please open this page on a wider screen to edit your flow.
          </p>
        </div>
      </div>

      <div className={`hidden md:block ${fullScreen ? "-m-3 min-h-[calc(100dvh-4rem)] space-y-4 bg-[#f5f5f5] p-3 sm:-m-4 sm:p-4 md:-m-6 md:min-h-dvh md:p-6" : "space-y-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-950">WhatsApp Flow Builder</h2>
          <p className="mt-1 text-sm text-neutral-500">Design the customer conversation that starts when someone messages your WhatsApp number.</p>
          <p className="mt-1 text-xs font-semibold text-neutral-400">Editing: {activeFlow.name}{entryFlowId === activeFlow.id ? ' · Entry flow' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={undo} disabled={!history.length} className="shell-button-secondary px-3 py-2 text-xs"><Undo2 className="h-4 w-4" /> Undo</button>
          <button type="button" onClick={redo} disabled={!future.length} className="shell-button-secondary px-3 py-2 text-xs"><Redo2 className="h-4 w-4" /> Redo</button>
          <button type="button" onClick={deleteSelected} disabled={!selectedNode || selectedNode.type === 'START'} className="shell-button-secondary px-3 py-2 text-xs text-rose-600"><Trash2 className="h-4 w-4" /> Delete</button>
          <button type="button" onClick={save} disabled={saveMutation.isPending} className="shell-button-primary px-4 py-2 text-sm"><Save className="h-4 w-4" /> Save Flow</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
        {visibleFlowLibrary.map((flow) => {
          const isActive = flow.id === activeFlowId;
          const isEntry = flow.id === entryFlowId;
          return (
            <div key={flow.id} className={`flex items-center gap-1 rounded-lg border px-1 py-1 ${isActive ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700'}`}>
              <button
                type="button"
                onClick={() => selectFlow(flow.id)}
                className="px-2 py-1 text-sm font-bold"
              >
                {flow.name}
              </button>
              <button
                type="button"
                title={isEntry ? 'Entry flow' : 'Make entry flow'}
                onClick={() => setEntryFlowId(flow.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-extrabold ${isEntry ? 'bg-[#00A884] text-white' : isActive ? 'bg-white/10 text-white/70 hover:text-white' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-900'}`}
              >
                Entry
              </button>
            </div>
          );
        })}
        <select
          value=""
          onChange={(event) => {
            const template = FLOW_TEMPLATES.find((item) => item.id === event.target.value);
            if (template) addFlowFromTemplate(template);
          }}
          className="shell-input-rect ml-auto bg-white text-sm"
          title="Add a pre-built flow you can then edit"
        >
          <option value="">+ Add from template…</option>
          {FLOW_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </div>

      <div className={`${fullScreen ? 'min-h-[calc(100dvh-10rem)]' : 'min-h-[760px]'} grid gap-4 xl:grid-cols-[190px_minmax(0,1fr)_340px]`}>
        <aside className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-neutral-400">Nodes</p>
          <div className="space-y-2">
            {visibleNodeTypes.map(([type, label, Icon]) => (
              <button key={type} type="button" onClick={() => addNode(type)} className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50">
                <Icon className="h-4 w-4 text-neutral-400" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
            Connect option handles on buttons, lists, and conditions to decide where each click goes.
          </div>
        </aside>

        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
          >
            <MiniMap pannable zoomable />
            <Controls />
            <Background gap={18} size={1} />
          </ReactFlow>
        </section>

        <aside className="space-y-4 overflow-y-auto">
          <Inspector selectedNode={selectedNode} updateNodeData={updateNodeData} services={services} flows={flows} propertyOptions={propertyOptions} catalogItems={catalogItems} catalogTypes={visibleCatalogTypes} />
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-sm font-extrabold text-neutral-900">Validation</p>
            {validationIssues.length ? (
              <ul className="mt-3 space-y-2 text-xs font-medium text-rose-600">
                {validationIssues.slice(0, 8).map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-semibold text-emerald-700">Ready to save.</p>
            )}
          </div>
          <Preview nodes={nodes} edges={edges} agency={agency} properties={properties} flows={flows} catalogItems={catalogItems} />
        </aside>
      </div>
      </div>
    </>
  );
}
