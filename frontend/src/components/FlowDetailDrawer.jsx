import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Copy,
  GripVertical,
  Moon,
  Plus,
  Save,
  Send,
  Settings,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateFlow, usePublishFlow, useUpdateFlow } from '../hooks/useFlows';

const DEFAULT_ENDPOINT = 'https://travelbot.wayon.in/api/whatsapp/flow';

const FLOW_TYPES = [
  ['PACKAGE', 'Package'],
  ['PROPERTY', 'Property'],
  ['VISA', 'Visa'],
  ['CRUISE', 'Cruise'],
  ['SERVICE', 'Service'],
  ['CUSTOM_TRIP', 'Custom Trip'],
  ['REVIEW', 'Review'],
  ['GENERIC', 'Generic'],
];

const STARTER_SCREENS = {
  PACKAGE: ['PACKAGE_SELECTOR', 'Choose Package'],
  PROPERTY: ['PROPERTY_FILTER', 'Find a Stay'],
  VISA: ['VISA_SELECTOR', 'Visa Services'],
  CRUISE: ['CRUISE_SELECTOR', 'Cruise Holidays'],
  SERVICE: ['SERVICE_SELECTOR', 'Our Services'],
  CUSTOM_TRIP: ['CUSTOM_TRIP_FORM', 'Custom Trip'],
  REVIEW: ['REVIEW_FORM', 'Trip Review'],
  GENERIC: ['WELCOME_SCREEN', 'Welcome'],
};

const CONTENT_TYPES = [
  ['Image', 'Image'],
  ['TextSubheading', 'Small heading'],
  ['TextHeading', 'Large heading'],
  ['TextBody', 'Body text'],
  ['TextInput', 'Short answer'],
  ['TextArea', 'Paragraph'],
  ['RadioButtonsGroup', 'Single choice'],
  ['Dropdown', 'Dropdown'],
  ['DatePicker', 'Date picker'],
  ['Footer', 'Button'],
];

const makeId = (prefix = 'item') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const makeScreenId = (title, index) => {
  const slug = String(title || `Screen ${index + 1}`)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || `SCREEN_${index + 1}`;
};

const makeFieldName = (label, fallback) => {
  const slug = String(label || fallback || 'field')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'field';
};

const createBlock = (kind) => {
  const id = makeId('block');
  if (kind === 'Image') return { id, kind, src: '', height: 160, scaleType: 'contain' };
  if (kind === 'TextHeading') return { id, kind, text: 'Question title' };
  if (kind === 'TextSubheading') return { id, kind, text: 'Section heading' };
  if (kind === 'TextBody') return { id, kind, text: 'Helpful instructions for the customer.' };
  if (kind === 'TextInput') return { id, kind, label: 'Your answer', name: 'answer', required: true, inputType: 'text' };
  if (kind === 'TextArea') return { id, kind, label: 'Leave a comment', name: 'comment', required: false };
  if (kind === 'RadioButtonsGroup') {
    return {
      id,
      kind,
      label: 'Choose one',
      name: 'choice',
      required: true,
      options: [
        { id: 'yes', title: 'Yes' },
        { id: 'no', title: 'No' },
      ],
    };
  }
  if (kind === 'Dropdown') {
    return {
      id,
      kind,
      label: 'Select an option',
      name: 'selection',
      required: true,
      options: [
        { id: 'option_1', title: 'Option 1' },
        { id: 'option_2', title: 'Option 2' },
      ],
    };
  }
  if (kind === 'DatePicker') return { id, kind, label: 'Select date', name: 'date', required: true };
  return { id, kind: 'Footer', label: 'Continue' };
};

const createStarterScreens = (flowType) => {
  const [id, title] = STARTER_SCREENS[flowType] || STARTER_SCREENS.GENERIC;
  return [
    {
      id,
      title,
      terminal: true,
      blocks: [
        { id: makeId('block'), kind: 'TextSubheading', text: title },
        { id: makeId('block'), kind: 'TextBody', text: 'Add the questions your customer should answer.' },
        { id: makeId('block'), kind: 'Footer', label: 'Continue' },
      ],
    },
  ];
};

const dynamicDataKey = (value) => {
  const match = String(value || '').match(/^\$\{data\.([^}]+)\}$/);
  return match?.[1] || null;
};

const extractDataSourceOptions = (dataSource, screenData = {}) => {
  if (Array.isArray(dataSource)) {
    return dataSource.map((option, index) => ({
      id: option.id || `option_${index + 1}`,
      title: option.title || `Option ${index + 1}`,
      description: option.description || '',
      metadata: option.metadata || '',
    }));
  }

  const key = dynamicDataKey(dataSource);
  const example = key ? screenData?.[key]?.__example__ : null;
  if (!Array.isArray(example)) return [];

  return example.map((option, index) => ({
    id: option.id || `option_${index + 1}`,
    title: option.title || `Option ${index + 1}`,
    description: option.description || '',
    metadata: option.metadata || '',
  }));
};

const blockFromComponent = (component, screenData = {}) => {
  const id = makeId('block');
  const kind = component?.type;
  const rawComponent = component ? { ...component } : null;
  if (kind === 'Image') {
    return {
      id,
      kind,
      rawComponent,
      src: component.src || '',
      height: component.height || 160,
      scaleType: component['scale-type'] || 'contain',
    };
  }
  if (['TextHeading', 'TextSubheading', 'TextBody', 'TextCaption'].includes(kind)) {
    return { id, kind, rawComponent, text: component.text || '' };
  }
  if (kind === 'TextInput') {
    return {
      id,
      kind,
      rawComponent,
      label: component.label || 'Your answer',
      name: component.name || 'answer',
      required: Boolean(component.required),
      inputType: component['input-type'] || 'text',
      helperText: component['helper-text'] || '',
    };
  }
  if (kind === 'TextArea') {
    return {
      id,
      kind,
      rawComponent,
      label: component.label || 'Leave a comment',
      name: component.name || 'comment',
      required: Boolean(component.required),
    };
  }
  if (['RadioButtonsGroup', 'Dropdown'].includes(kind)) {
    const dataSource = component['data-source'];
    return {
      id,
      kind,
      rawComponent,
      label: component.label || 'Choose one',
      name: component.name || 'choice',
      required: Boolean(component.required),
      dataSourceExpression: typeof dataSource === 'string' ? dataSource : '',
      options: extractDataSourceOptions(dataSource, screenData),
    };
  }
  if (kind === 'DatePicker') {
    return {
      id,
      kind,
      rawComponent,
      label: component.label || 'Select date',
      name: component.name || 'date',
      required: Boolean(component.required),
    };
  }
  if (kind === 'Footer') return { id, kind, rawComponent, label: component.label || 'Continue' };
  if (component?.text || component?.label) return { id, kind: kind || 'TextBody', rawComponent, text: component.text || component.label };
  return null;
};

const screensFromJson = (json, fallbackType) => {
  if (!Array.isArray(json?.screens) || json.screens.length === 0) return createStarterScreens(fallbackType);

  return json.screens.map((screen, index) => {
    const layoutChildren = Array.isArray(screen.layout?.children) ? screen.layout.children : [];
    const formNode = layoutChildren.find((child) => child?.type === 'Form');
    const contentChildren = Array.isArray(formNode?.children) ? formNode.children : layoutChildren;
    const blocks = contentChildren.map((component) => blockFromComponent(component, screen.data)).filter(Boolean);

    return {
      id: screen.id || makeScreenId(screen.title, index),
      title: screen.title || `Screen ${index + 1}`,
      terminal: Boolean(screen.terminal || index === json.screens.length - 1),
      data: screen.data || {},
      formName: formNode?.name || 'flow_form',
      rawScreen: { ...screen },
      blocks: blocks.length ? blocks : [createBlock('Footer')],
    };
  });
};

const componentFromBlock = (block, screenIndex, screenCount, nextScreenId) => {
  const base = block.rawComponent ? { ...block.rawComponent } : {};
  if (block.kind === 'Image') {
    return {
      ...base,
      type: 'Image',
      src: block.src || base.src || '',
      height: Number(block.height || base.height || 160),
      'scale-type': block.scaleType || base['scale-type'] || 'contain',
    };
  }
  if (['TextHeading', 'TextSubheading', 'TextBody', 'TextCaption'].includes(block.kind)) {
    return { ...base, type: block.kind, text: block.text || '' };
  }
  if (block.kind === 'TextInput') {
    return {
      ...base,
      type: 'TextInput',
      label: block.label || 'Your answer',
      name: block.name || makeFieldName(block.label, 'answer'),
      required: Boolean(block.required),
      'input-type': block.inputType || 'text',
      ...(block.helperText ? { 'helper-text': block.helperText } : {}),
    };
  }
  if (block.kind === 'TextArea') {
    return {
      ...base,
      type: 'TextArea',
      label: block.label || 'Leave a comment',
      name: block.name || makeFieldName(block.label, 'comment'),
      required: Boolean(block.required),
    };
  }
  if (['RadioButtonsGroup', 'Dropdown'].includes(block.kind)) {
    return {
      ...base,
      type: block.kind,
      label: block.label || 'Choose one',
      name: block.name || makeFieldName(block.label, 'choice'),
      required: Boolean(block.required),
      'data-source': block.dataSourceExpression || (block.options || []).map((option, index) => ({
        id: option.id || `option_${index + 1}`,
        title: option.title || `Option ${index + 1}`,
        ...(option.description ? { description: option.description } : {}),
        ...(option.metadata ? { metadata: option.metadata } : {}),
      })),
    };
  }
  if (block.kind === 'DatePicker') {
    return {
      ...base,
      type: 'DatePicker',
      label: block.label || 'Select date',
      name: block.name || makeFieldName(block.label, 'date'),
      required: Boolean(block.required),
    };
  }

  const terminalAction = screenIndex === screenCount - 1 || !nextScreenId;
  return {
    ...base,
    type: 'Footer',
    label: block.label || 'Continue',
    'on-click-action': base['on-click-action'] || (terminalAction
      ? { name: 'complete', payload: {} }
      : { name: 'navigate', next: { type: 'screen', name: nextScreenId }, payload: {} }),
  };
};

const buildFlowJson = (screens, sourceJson = {}) => {
  const routingModel = screens.reduce((model, screen, index) => {
    const originalRoutes = sourceJson.routing_model?.[screen.id];
    model[screen.id] = Array.isArray(originalRoutes)
      ? originalRoutes.filter((targetId) => screens.some((candidate) => candidate.id === targetId))
      : screens[index + 1] ? [screens[index + 1].id] : [];
    return model;
  }, {});

  return {
    ...sourceJson,
    version: sourceJson.version || '7.2',
    data_api_version: sourceJson.data_api_version || '3.0',
    routing_model: routingModel,
    screens: screens.map((screen, index) => {
      const blocks = screen.blocks.some((block) => block.kind === 'Footer')
        ? screen.blocks
        : [...screen.blocks, createBlock('Footer')];

      return {
        ...(screen.rawScreen || {}),
        id: screen.id,
        title: screen.title,
        terminal: index === screens.length - 1,
        data: screen.data || screen.rawScreen?.data || {},
        layout: {
          ...(screen.rawScreen?.layout || {}),
          type: screen.rawScreen?.layout?.type || 'SingleColumnLayout',
          children: [
            {
              ...(screen.rawScreen?.layout?.children?.find((child) => child?.type === 'Form') || {}),
              type: 'Form',
              name: screen.formName || 'flow_form',
              children: blocks.map((block) => componentFromBlock(block, index, screens.length, screens[index + 1]?.id)),
            },
          ],
        },
      };
    }),
  };
};

const contentTypeLabel = (kind) => CONTENT_TYPES.find(([value]) => value === kind)?.[1] || kind;

const blockSummary = (block) => {
  if (['TextHeading', 'TextSubheading', 'TextBody', 'TextCaption'].includes(block.kind)) return block.text || 'Empty text';
  if (block.kind === 'Footer') return block.label || 'Continue';
  return block.label || 'Untitled field';
};

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-neutral-800">{label}</span>
      {children}
    </label>
  );
}

function PhonePreview({ screen, theme, platform, interactiveMode }) {
  const dark = theme === 'dark';

  return (
    <div className="mx-auto w-full max-w-[310px]">
      <div className="rounded-[22px] bg-neutral-100 p-1.5 shadow-[0_0_0_1px_rgba(15,23,42,0.05),0_12px_28px_-20px_rgba(15,23,42,0.55)]">
        <div className={`h-[468px] overflow-hidden rounded-[17px] border ${dark ? 'border-neutral-700 bg-neutral-950 text-white' : 'border-neutral-100 bg-white text-neutral-900'}`}>
          <div className={`h-8 ${dark ? 'bg-neutral-800' : 'bg-neutral-300'}`} />
          <div className={`flex h-12 items-center justify-between border-b px-3 text-[12px] ${dark ? 'border-neutral-800' : 'border-neutral-100'}`}>
            <span className="text-lg leading-none">{interactiveMode ? 'x' : ''}</span>
            <span className="max-w-[190px] truncate font-medium">{screen?.title || 'Untitled screen'}</span>
            <span className="text-lg leading-none">...</span>
          </div>
          <div className="h-[380px] overflow-y-auto px-3 py-4">
            {(screen?.blocks || []).map((block) => {
              if (block.kind === 'Image') {
                return (
                  <div key={block.id} className={`mb-4 flex items-center justify-center overflow-hidden rounded ${dark ? 'bg-neutral-900' : 'bg-neutral-100'}`} style={{ height: Math.min(Number(block.height || 160), 220) }}>
                    {block.src ? (
                      <img src={block.src.startsWith('data:') ? block.src : `data:image/png;base64,${block.src}`} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className={`text-[11px] ${dark ? 'text-neutral-600' : 'text-neutral-400'}`}>Image</span>
                    )}
                  </div>
                );
              }
              if (block.kind === 'TextHeading') {
                return <h3 key={block.id} className="mb-3 text-[16px] font-bold leading-tight">{block.text || 'Question title'}</h3>;
              }
              if (block.kind === 'TextSubheading') {
                return <h4 key={block.id} className="mb-2 text-[14px] font-bold leading-tight">{block.text || 'Section heading'}</h4>;
              }
              if (block.kind === 'TextBody' || block.kind === 'TextCaption') {
                return <p key={block.id} className={`mb-4 text-[12px] leading-relaxed ${dark ? 'text-neutral-300' : 'text-neutral-600'}`}>{block.text || 'Helpful instructions.'}</p>;
              }
              if (block.kind === 'RadioButtonsGroup') {
                return (
                  <div key={block.id} className="mb-4">
                    <p className="mb-3 text-[12px] font-medium">{block.label || 'Choose one'}</p>
                    {(block.options || []).map((option) => (
                      <div key={option.id} className="mb-3 flex items-center justify-between text-[12px]">
                        <span>{option.title}</span>
                        <span className={`h-3.5 w-3.5 rounded-full border ${dark ? 'border-neutral-500' : 'border-neutral-500'}`} />
                      </div>
                    ))}
                  </div>
                );
              }
              if (block.kind === 'Dropdown') {
                return (
                  <div key={block.id} className="mb-4">
                    <p className="mb-1.5 text-[12px] font-medium">{block.label || 'Select an option'}</p>
                    <div className={`flex h-10 items-center justify-between rounded border px-3 text-[12px] ${dark ? 'border-neutral-700 text-neutral-300' : 'border-neutral-300 text-neutral-500'}`}>
                      Select
                      <ChevronDown className="h-3.5 w-3.5" />
                    </div>
                  </div>
                );
              }
              if (block.kind === 'DatePicker' || block.kind === 'TextInput') {
                return (
                  <div key={block.id} className="mb-4">
                    <p className="mb-1.5 text-[12px] font-medium">{block.label || 'Your answer'}</p>
                    <div className={`h-10 rounded border px-3 py-2 text-[12px] ${dark ? 'border-neutral-700 text-neutral-400' : 'border-neutral-300 text-neutral-400'}`}>
                      {block.kind === 'DatePicker' ? 'DD/MM/YYYY' : 'Type here'}
                    </div>
                  </div>
                );
              }
              if (block.kind === 'TextArea') {
                return (
                  <div key={block.id} className="mb-4">
                    <p className="mb-1.5 text-[12px] font-medium">{block.label || 'Leave a comment'}</p>
                    <div className={`h-20 rounded border px-3 py-2 text-[12px] ${dark ? 'border-neutral-700 text-neutral-400' : 'border-neutral-300 text-neutral-400'}`}>Leave a comment</div>
                    <p className={`mt-1 text-right text-[10px] ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>0 / 600</p>
                  </div>
                );
              }
              return (
                <button key={block.id} type="button" className={`mt-2 h-9 w-full rounded-full text-[11px] font-bold ${dark ? 'bg-neutral-800 text-neutral-500' : 'bg-neutral-100 text-neutral-400'}`}>
                  {block.label || block.text || 'Continue'}
                </button>
              );
            })}
          </div>
          <div className={`border-t px-3 py-2 text-center text-[9px] ${dark ? 'border-neutral-800 text-neutral-500' : 'border-neutral-100 text-neutral-500'}`}>
            {platform} preview. Managed by the business.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlowDetailDrawer({ isOpen, onClose, flow }) {
  const createMutation = useCreateFlow();
  const updateMutation = useUpdateFlow();
  const publishMutation = usePublishFlow();
  const [formData, setFormData] = useState({
    name: '',
    flowType: 'PACKAGE',
    endpointUri: DEFAULT_ENDPOINT,
    categories: ['OTHER'],
    firstScreenId: 'PACKAGE_SELECTOR',
  });
  const [originalJson, setOriginalJson] = useState({});
  const [screens, setScreens] = useState(() => createStarterScreens('PACKAGE'));
  const [activeScreenId, setActiveScreenId] = useState('PACKAGE_SELECTOR');
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [contentMenuOpen, setContentMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [platform, setPlatform] = useState('Android');
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (flow) {
      const jsonDefinition = flow.jsonDefinition || {};
      const initialScreens = screensFromJson(jsonDefinition, flow.flowType || 'GENERIC');
      setOriginalJson(jsonDefinition);
      setFormData({
        name: flow.name || '',
        flowType: flow.flowType || 'GENERIC',
        endpointUri: flow.endpointUri || DEFAULT_ENDPOINT,
        categories: flow.categories || ['OTHER'],
        firstScreenId: flow.firstScreenId || initialScreens[0]?.id || '',
      });
      setScreens(initialScreens);
      setActiveScreenId(flow.firstScreenId || initialScreens[0]?.id || '');
      setExpandedBlockId(initialScreens[0]?.blocks?.[0]?.id || null);
    } else {
      const starterScreens = createStarterScreens('PACKAGE');
      setOriginalJson({});
      setFormData({
        name: '',
        flowType: 'PACKAGE',
        endpointUri: DEFAULT_ENDPOINT,
        categories: ['OTHER'],
        firstScreenId: starterScreens[0].id,
      });
      setScreens(starterScreens);
      setActiveScreenId(starterScreens[0].id);
      setExpandedBlockId(starterScreens[0].blocks[0].id);
    }
  }, [flow]);

  const activeScreen = useMemo(
    () => screens.find((screen) => screen.id === activeScreenId) || screens[0],
    [activeScreenId, screens],
  );

  const flowJson = useMemo(() => buildFlowJson(screens, originalJson), [originalJson, screens]);
  const prettyJson = useMemo(() => JSON.stringify(flowJson, null, 2), [flowJson]);

  if (!isOpen) return null;

  const updateActiveScreen = (patch) => {
    setScreens((current) =>
      current.map((screen) => {
        if (screen.id !== activeScreen.id) return screen;
        const next = { ...screen, ...patch };
        if (patch.title && !patch.id) next.id = screen.id;
        return next;
      }),
    );
  };

  const updateBlock = (blockId, patch) => {
    setScreens((current) =>
      current.map((screen) =>
        screen.id === activeScreen.id
          ? { ...screen, blocks: screen.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)) }
          : screen,
      ),
    );
  };

  const updateOption = (blockId, optionIndex, patch) => {
    setScreens((current) =>
      current.map((screen) =>
        screen.id === activeScreen.id
          ? {
              ...screen,
              blocks: screen.blocks.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      options: (block.options || []).map((option, index) => (index === optionIndex ? { ...option, ...patch } : option)),
                    }
                  : block,
              ),
            }
          : screen,
      ),
    );
  };

  const addOption = (blockId) => {
    setScreens((current) =>
      current.map((screen) =>
        screen.id === activeScreen.id
          ? {
              ...screen,
              blocks: screen.blocks.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      options: [...(block.options || []), { id: `option_${(block.options || []).length + 1}`, title: `Option ${(block.options || []).length + 1}` }],
                    }
                  : block,
              ),
            }
          : screen,
      ),
    );
  };

  const removeOption = (blockId, optionIndex) => {
    setScreens((current) =>
      current.map((screen) =>
        screen.id === activeScreen.id
          ? {
              ...screen,
              blocks: screen.blocks.map((block) =>
                block.id === blockId
                  ? { ...block, options: (block.options || []).filter((_, index) => index !== optionIndex) }
                  : block,
              ),
            }
          : screen,
      ),
    );
  };

  const addScreen = () => {
    const title = `Screen ${screens.length + 1}`;
    const nextScreen = {
      id: makeScreenId(title, screens.length),
      title,
      terminal: true,
      blocks: [createBlock('TextSubheading'), createBlock('Footer')],
    };
    setScreens((current) => current.map((screen) => ({ ...screen, terminal: false })).concat(nextScreen));
    setActiveScreenId(nextScreen.id);
    setFormData((current) => ({ ...current, firstScreenId: current.firstScreenId || nextScreen.id }));
    setExpandedBlockId(nextScreen.blocks[0].id);
  };

  const removeScreen = (screenId) => {
    if (screens.length === 1) {
      toast.error('A flow needs at least one screen');
      return;
    }
    const nextScreens = screens.filter((screen) => screen.id !== screenId);
    setScreens(nextScreens);
    if (activeScreenId === screenId) setActiveScreenId(nextScreens[0].id);
    if (formData.firstScreenId === screenId) setFormData((current) => ({ ...current, firstScreenId: nextScreens[0].id }));
  };

  const addBlock = (kind) => {
    const nextBlock = createBlock(kind);
    setScreens((current) =>
      current.map((screen) =>
        screen.id === activeScreen.id ? { ...screen, blocks: [...screen.blocks, nextBlock] } : screen,
      ),
    );
    setExpandedBlockId(nextBlock.id);
    setContentMenuOpen(false);
  };

  const removeBlock = (blockId) => {
    setScreens((current) =>
      current.map((screen) =>
        screen.id === activeScreen.id ? { ...screen, blocks: screen.blocks.filter((block) => block.id !== blockId) } : screen,
      ),
    );
  };

  const handleTypeChange = (value) => {
    const starterScreens = createStarterScreens(value);
    setFormData((current) => ({
      ...current,
      flowType: value,
      firstScreenId: starterScreens[0].id,
    }));
    setScreens(starterScreens);
    setActiveScreenId(starterScreens[0].id);
    setExpandedBlockId(starterScreens[0].blocks[0].id);
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(prettyJson);
    toast.success('Flow JSON copied');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Flow name is required');
      return;
    }
    if (!screens.length || !screens[0].id) {
      toast.error('Add at least one valid screen');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      flowType: formData.flowType,
      endpointUri: formData.endpointUri.trim(),
      firstScreenId: formData.firstScreenId || screens[0].id,
      categories: formData.categories,
      jsonDefinition: flowJson,
    };

    if (flow?.id) {
      await updateMutation.mutateAsync({ id: flow.id, data: payload });
      toast.success('Flow updated');
    } else {
      await createMutation.mutateAsync(payload);
      toast.success('Flow created');
      onClose();
    }
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
      <div className="absolute inset-0 bg-neutral-900/45" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[1240px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-neutral-900">{flow ? formData.name || flow.name : 'New Flow'}</h2>
            <p className="mt-1 text-sm text-neutral-500">Create, preview, copy JSON, save, and publish WhatsApp Flows without editing code.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="shell-button-primary min-h-10 px-3">
              <Save className="h-4 w-4" />
              Save
            </button>
            <button type="button" onClick={handlePublish} disabled={!flow?.id || publishMutation.isPending} className="shell-button-secondary min-h-10 px-3">
              <Send className="h-4 w-4" />
              Publish
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700" title="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 lg:grid-cols-[minmax(180px,1fr)_180px_minmax(220px,1fr)_180px]">
            <Field label="Flow name">
              <input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="shell-input-rect bg-white" placeholder="Example: Visa enquiry flow" />
            </Field>
            <Field label="Flow type">
              <select value={formData.flowType} onChange={(event) => handleTypeChange(event.target.value)} className="shell-input-rect bg-white">
                {FLOW_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Endpoint URI">
              <input value={formData.endpointUri} onChange={(event) => setFormData({ ...formData, endpointUri: event.target.value })} className="shell-input-rect bg-white" />
            </Field>
            <Field label="First screen">
              <select value={formData.firstScreenId} onChange={(event) => setFormData({ ...formData, firstScreenId: event.target.value })} className="shell-input-rect bg-white">
                {screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.id}</option>)}
              </select>
            </Field>
          </div>

          <p className="mb-3 text-sm text-neutral-700">
            Use this page to quickly configure and preview a basic Flow. Copy Flow JSON is available for Meta review, while Save and Publish use your TravelBot connection.
          </p>

          <div className="grid min-h-[700px] overflow-hidden rounded-lg border border-[#cbd5e1] bg-white lg:grid-cols-[424px_minmax(0,1fr)]">
            <div className="border-r border-[#cbd5e1] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-neutral-900">Screens</h3>
                <span className="text-xs font-semibold text-neutral-500">{screens.length} total</span>
              </div>
              <div className="mt-3 space-y-1">
                {screens.map((screen) => (
                  <div key={screen.id} className={`flex h-9 items-center gap-2 rounded px-2 text-sm ${screen.id === activeScreenId ? 'bg-[#dbeafe] text-neutral-900' : 'text-neutral-800 hover:bg-neutral-50'}`}>
                    <GripVertical className="h-4 w-4 shrink-0 text-neutral-700" />
                    <button type="button" onClick={() => setActiveScreenId(screen.id)} className="min-w-0 flex-1 truncate text-left">
                      {screen.title}
                    </button>
                    <button type="button" onClick={() => removeScreen(screen.id)} className="rounded p-1 text-neutral-700 hover:bg-white" title="Delete screen">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addScreen} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#0064c8]">
                + Add new
              </button>

              <div className="my-5 border-t border-[#cbd5e1]" />

              <h3 className="text-[17px] font-bold text-neutral-900">Edit content</h3>
              <div className="mt-3 rounded bg-[#e7f3ff] p-2">
                <Field label="Screen title">
                  <input value={activeScreen?.title || ''} onChange={(event) => updateActiveScreen({ title: event.target.value })} className="h-11 w-full rounded border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1877f2]" />
                </Field>
              </div>

              <div className="mt-4 space-y-1">
                {(activeScreen?.blocks || []).map((block) => {
                  const expanded = expandedBlockId === block.id;
                  return (
                    <div key={block.id}>
                      <div className="flex min-h-11 items-center gap-2 text-sm text-neutral-900">
                        <GripVertical className="h-4 w-4 shrink-0 text-neutral-700" />
                        <button type="button" onClick={() => setExpandedBlockId(expanded ? null : block.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          <span className="shrink-0">{contentTypeLabel(block.kind)}</span>
                          <span className="text-neutral-400">-</span>
                          <span className="truncate text-neutral-500">{blockSummary(block)}</span>
                        </button>
                        <button type="button" onClick={() => removeBlock(block.id)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-rose-600" title="Delete content">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setExpandedBlockId(expanded ? null : block.id)} className="rounded p-1 text-neutral-700 hover:bg-neutral-100" title="Edit content">
                          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {expanded && (
                        <div className="mb-2 rounded bg-[#e7f3ff] p-3">
                          {block.kind === 'Image' && (
                            <div className="grid gap-3">
                              <Field label="Image source">
                                <textarea value={block.src || ''} onChange={(event) => updateBlock(block.id, { src: event.target.value })} className="min-h-20 w-full resize-y rounded border border-[#cbd5e1] bg-white px-3 py-2 font-mono text-xs outline-none focus:border-[#1877f2]" placeholder="Base64 image or data URL" />
                              </Field>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Height">
                                  <input value={block.height || ''} onChange={(event) => updateBlock(block.id, { height: event.target.value })} className="h-10 w-full rounded border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1877f2]" />
                                </Field>
                                <Field label="Scale type">
                                  <select value={block.scaleType || 'contain'} onChange={(event) => updateBlock(block.id, { scaleType: event.target.value })} className="h-10 w-full rounded border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1877f2]">
                                    <option value="contain">Contain</option>
                                    <option value="cover">Cover</option>
                                  </select>
                                </Field>
                              </div>
                            </div>
                          )}
                          {['TextHeading', 'TextSubheading', 'TextBody', 'TextCaption'].includes(block.kind) && (
                            <Field label="Text">
                              <textarea value={block.text || ''} onChange={(event) => updateBlock(block.id, { text: event.target.value })} className="min-h-20 w-full resize-y rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#1877f2]" />
                            </Field>
                          )}
                          {['TextInput', 'TextArea', 'RadioButtonsGroup', 'Dropdown', 'DatePicker'].includes(block.kind) && (
                            <div className="grid gap-3">
                              <Field label="Label">
                                <input value={block.label || ''} onChange={(event) => updateBlock(block.id, { label: event.target.value, name: block.name || makeFieldName(event.target.value, block.kind) })} className="h-10 w-full rounded border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1877f2]" />
                              </Field>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Field key">
                                  <input value={block.name || ''} onChange={(event) => updateBlock(block.id, { name: makeFieldName(event.target.value, block.kind) })} className="h-10 w-full rounded border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1877f2]" />
                                </Field>
                                <Field label="Required">
                                  <select value={block.required ? 'yes' : 'no'} onChange={(event) => updateBlock(block.id, { required: event.target.value === 'yes' })} className="h-10 w-full rounded border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1877f2]">
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                  </select>
                                </Field>
                              </div>
                            </div>
                          )}
                          {block.kind === 'TextInput' && (
                            <Field label="Input type">
                              <select value={block.inputType || 'text'} onChange={(event) => updateBlock(block.id, { inputType: event.target.value })} className="mt-3 h-10 w-full rounded border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1877f2]">
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="phone">Phone</option>
                              </select>
                            </Field>
                          )}
                          {['RadioButtonsGroup', 'Dropdown'].includes(block.kind) && (
                            <div className="mt-3">
                              {block.dataSourceExpression && (
                                <Field label="Dynamic source from JSON">
                                  <input value={block.dataSourceExpression} readOnly className="mb-3 h-10 w-full rounded border border-[#cbd5e1] bg-white px-3 font-mono text-xs text-neutral-500 outline-none" />
                                </Field>
                              )}
                              <span className="mb-2 block text-[13px] font-semibold text-neutral-800">Options</span>
                              {block.dataSourceExpression && (
                                <p className="mb-2 text-xs text-neutral-500">These preview options come from the screen data example. The saved JSON keeps the dynamic source.</p>
                              )}
                              <div className="space-y-2">
                                {(block.options || []).map((option, optionIndex) => (
                                  <div key={`${block.id}-${optionIndex}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                    <input value={option.id || ''} onChange={(event) => updateOption(block.id, optionIndex, { id: makeFieldName(event.target.value, `option_${optionIndex + 1}`) })} className="h-9 rounded border border-[#cbd5e1] bg-white px-2 text-xs outline-none focus:border-[#1877f2]" placeholder="id" />
                                    <input value={option.title || ''} onChange={(event) => updateOption(block.id, optionIndex, { title: event.target.value })} className="h-9 rounded border border-[#cbd5e1] bg-white px-2 text-xs outline-none focus:border-[#1877f2]" placeholder="label" />
                                    <button type="button" onClick={() => removeOption(block.id, optionIndex)} className="h-9 rounded border border-[#cbd5e1] bg-white px-2 text-neutral-500 hover:text-rose-600" title="Delete option">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button type="button" onClick={() => addOption(block.id)} className="mt-2 text-sm font-medium text-[#0064c8]">+ Add option</button>
                            </div>
                          )}
                          {block.kind === 'Footer' && (
                            <Field label="Button label">
                              <input value={block.label || ''} onChange={(event) => updateBlock(block.id, { label: event.target.value })} className="h-10 w-full rounded border border-[#cbd5e1] bg-white px-3 text-sm outline-none focus:border-[#1877f2]" />
                            </Field>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="relative mt-4">
                <button type="button" onClick={() => setContentMenuOpen((open) => !open)} className="inline-flex h-9 items-center gap-2 rounded border border-[#b8c4d2] bg-white px-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
                  <Plus className="h-4 w-4" />
                  Add content
                  <ChevronDown className="h-4 w-4" />
                </button>
                {contentMenuOpen && (
                  <div className="absolute left-0 top-11 z-20 w-56 rounded border border-neutral-200 bg-white py-1 shadow-xl">
                    {CONTENT_TYPES.map(([kind, label]) => (
                      <button key={kind} type="button" onClick={() => addBlock(kind)} className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50">
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="relative flex flex-col">
              <div className="flex items-center justify-between gap-3 px-4 py-2">
                <h3 className="text-[17px] font-bold text-neutral-900">Preview</h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={copyJson} className="inline-flex h-9 items-center gap-2 rounded border border-[#b8c4d2] bg-white px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50">
                    <Copy className="h-4 w-4" />
                    Copy Flow JSON
                  </button>
                  <div className="relative">
                    <button type="button" onClick={() => setSettingsOpen((open) => !open)} className="inline-flex h-9 items-center gap-2 rounded border border-[#b8c4d2] bg-[#edf2f7] px-3 text-neutral-800 hover:bg-neutral-100">
                      <Settings className="h-4 w-4" />
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {settingsOpen && (
                      <div className="absolute right-0 top-11 z-20 w-56 rounded border border-neutral-200 bg-white p-3 text-sm shadow-xl">
                        <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                          <span>Interactive mode</span>
                          <button type="button" onClick={() => setInteractiveMode((value) => !value)} className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${interactiveMode ? 'bg-[#1877f2]' : 'bg-neutral-200'}`}>
                            <span className={`h-4 w-4 rounded-full bg-white shadow transition ${interactiveMode ? 'translate-x-4' : ''}`} />
                          </button>
                        </div>
                        <p className="mt-3 font-bold text-neutral-800">Platform</p>
                        {['Android', 'iOS'].map((item) => (
                          <button key={item} type="button" onClick={() => setPlatform(item)} className={`mt-2 block w-full rounded px-2 py-1.5 text-left ${platform === item ? 'bg-neutral-100 font-semibold' : ''}`}>
                            {item}
                          </button>
                        ))}
                        <div className="my-3 border-t border-neutral-200" />
                        <p className="font-bold text-neutral-800">Theme</p>
                        <button type="button" onClick={() => setTheme('light')} className={`mt-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${theme === 'light' ? 'bg-neutral-100 font-semibold' : ''}`}>
                          <Sun className="h-4 w-4" />
                          Light
                        </button>
                        <button type="button" onClick={() => setTheme('dark')} className={`mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${theme === 'dark' ? 'bg-neutral-100 font-semibold' : ''}`}>
                          <Moon className="h-4 w-4" />
                          Dark
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 items-start justify-center overflow-auto px-4 py-10">
                <PhonePreview screen={activeScreen} theme={theme} platform={platform} interactiveMode={interactiveMode} />
                <div className="ml-7 hidden h-[510px] w-1 rounded-full bg-neutral-300 lg:block" />
              </div>
              <div className="border-t border-[#cbd5e1] px-4 py-3 text-sm text-neutral-900">
                Rendering and interaction varies based on device. Current Flow status: <span className="font-semibold">{flow?.status || 'DRAFT'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
