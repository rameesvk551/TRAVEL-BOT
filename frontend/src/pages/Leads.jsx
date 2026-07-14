import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import LeadCard from '../components/LeadCard';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  BanknotesIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  TrophyIcon,
  UserPlusIcon,
  XCircleIcon,
  XMarkIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../components/Pagination';
import client from '../api/client';
import {
  useAddFollowUp,
  useAddNote,
  useBulkAssignLeads,
  useBulkDeleteLeads,
  useLead,
  useLeads,
  usePipelineStages,
  useSendStaffFirstOutreach,
  useUpdateFollowUp,
  useUpdateLead,
} from '../hooks/useLeads';
import { useCallLogs } from '../hooks/useCalls';
import { useLeadsByAdReport } from '../hooks/useAnalytics';
import { callsApi } from '../api/callsApi';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDate, formatDateTime, formatPhone, timeAgo } from '../utils/formatters';
import { mergeAssignedAgentOption } from '../utils/agentOptions';
import {
  DATE_RANGE_OPTIONS,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  formatSource,
  formatStatus,
  getActivityLabel,
  getAttentionBadges,
  getLeadScore,
  getLeadScoreTone,
  getLeadStageColor,
  getLeadStageLabel,
  getLeadValueLabel,
  getNextAction,
  getNextFollowUp,
  matchesAgent,
  matchesDateRange,
  matchesSource,
  matchesTag,
  needsAttention,
  sortLeads,
} from '../utils/leadInsights';
import { getInitials, getStatusTone, getStagePillStyle } from '../components/uiHelpers';
import LeadPipeline from '../components/LeadPipeline';
import NewLeadModal from '../components/NewLeadModal';
import ActivityTimeline from '../components/ActivityTimeline';
import toast from 'react-hot-toast';

const BASE_TABS = [
  { key: 'Needs Attention', label: 'Needs Attention' },
  { key: 'All Leads', label: 'All Leads' },
];

const PAGE_SIZE_DEFAULT = 12;
const PAGE_SIZE_OPTIONS = [10, 12, 25, 50];
const EXPORT_PAGE_SIZE = 200;
const MAX_EXPORT_PAGES = 100;

const EMPTY = '-';

function isWeakAdLabel(value) {
  const label = String(value || '').trim().toLowerCase();
  return !label || label === 'api.whatsapp.com' || label === 'whatsapp' || label === 'www.whatsapp.com' || label.includes('api.whatsapp.com');
}

function summarizeAdBody(value) {
  const firstLine = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return '';
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function getCtwaReferral(lead) {
  return lead?.metaRawPayload?.ctwaReferral || lead?.metaRawPayload?.ctwa_referral || {};
}

// Readable label for the Meta ad a lead came from (Click-to-WhatsApp attribution).
// Prefer stable Ads Manager grouping names over noisy CTWA headlines like api.whatsapp.com.
function getLeadAdLabel(lead) {
  if (!lead?.adId) return '';
  const referral = getCtwaReferral(lead);
  return lead.metaAdSetName
    || lead.metaCampaignName
    || (!isWeakAdLabel(lead.metaAdName) ? lead.metaAdName : '')
    || (!isWeakAdLabel(lead.adHeadline) ? lead.adHeadline : '')
    || summarizeAdBody(referral.body)
    || `Ad ${String(lead.adId).slice(-6)}`;
}

function getLeadAdSubLabel(lead) {
  if (!lead?.adId) return '';
  const label = getLeadAdLabel(lead);
  const parts = [];

  if (lead.metaCampaignName && lead.metaCampaignName !== label) parts.push(lead.metaCampaignName);
  if (lead.metaAdSetName && lead.metaAdSetName !== label) parts.push(lead.metaAdSetName);
  parts.push(`ID ${lead.adId}`);

  return parts.join(' | ');
}

function formatAdOptionLabel(option) {
  const label = option.label || `Ad ${String(option.value || '').slice(-6)}`;
  const shortId = String(option.value || '').slice(-6);
  const withId = shortId && !label.includes(shortId) ? `${label} | ${shortId}` : label;
  return option.leads ? `${withId} (${option.leads})` : withId;
}

function getAdOptionBaseLabel(ad) {
  const adId = ad.adId || ad.value || '';
  return ad.adSetName
    || ad.campaignName
    || (!isWeakAdLabel(ad.adName) ? ad.adName : '')
    || summarizeAdBody(ad.adBody)
    || `Ad ${String(adId).slice(-6)}`;
}

function escapeExcelCell(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getLeadExportRows(leads = []) {
  return leads.map((lead, index) => {
    const nextFollowUp = getNextFollowUp(lead);
    const travellers = Number(lead.travellers || 1);
    const budget = Number(lead.budgetPerPerson || 0);

    return {
      'SL No': index + 1,
      Created: formatDateTime(lead.createdAt),
      Name: lead.customer?.name || '',
      Phone: formatPhone(lead.customer?.phone) || '',
      Email: lead.customer?.email || '',
      Source: formatSource(lead.source),
      'Source Ad': getLeadAdLabel(lead),
      'Source Ad ID': lead.adId || '',
      'Ad Set': lead.metaAdSetName || '',
      Status: formatStatus(lead.status),
      Destination: lead.destination || '',
      'Travel Dates': lead.travelDates || '',
      Travellers: lead.travellers || '',
      'Budget / Person': budget ? formatCurrency(budget) : '',
      'Lead Value': budget ? formatCurrency(budget * travellers) : '',
      'Assigned To': lead.assignedAgent?.name || '',
      'Next Follow-Up': nextFollowUp ? formatDateTime(nextFollowUp.scheduledAt) : '',
      Campaign: lead.campaignName || lead.metaCampaignName || '',
      Tags: Array.isArray(lead.tags) ? lead.tags.join(', ') : '',
      Notes: lead.notes || '',
    };
  });
}

function downloadExcelFile(filename, rows) {
  const headers = rows.length ? Object.keys(rows[0]) : ['SL No'];
  const tableRows = [
    `<tr>${headers.map((header) => `<th>${escapeExcelCell(header)}</th>`).join('')}</tr>`,
    ...rows.map((row) => (
      `<tr>${headers.map((header) => `<td>${escapeExcelCell(row[header])}</td>`).join('')}</tr>`
    )),
  ].join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getDefaultFollowupDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatServiceLabel(value = '') {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'FLIGHT') return 'Flight';
  if (normalized === 'RAIL') return 'Rail';
  if (normalized === 'VISA_TICKETING') return 'Visa & Ticketing';
  if (normalized === 'VIEWED') return 'Viewed';
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || EMPTY;
}

function selectedItemTypeMeta(itemType = '') {
  const type = String(itemType || '').toUpperCase();
  const meta = {
    PACKAGE: ['Package', 'bg-emerald-50 text-emerald-700'],
    PROPERTY: ['Property', 'bg-sky-50 text-sky-700'],
    SERVICE: ['Service', 'bg-purple-50 text-purple-700'],
    VISA: ['Visa', 'bg-amber-50 text-amber-700'],
    CRUISE: ['Cruise', 'bg-cyan-50 text-cyan-700'],
  };
  return meta[type] || [formatServiceLabel(type || 'Item'), 'bg-neutral-100 text-neutral-600'];
}

function formatReadinessAnswer(value = '') {
  if (Array.isArray(value)) return value.map(formatReadinessAnswer).filter(Boolean).join(', ') || EMPTY;
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || EMPTY;
}

function hasCustomTripDetails(details = {}) {
  const hasFlowAnswers = Boolean(details.flowAnswers && Object.keys(details.flowAnswers).length);
  const hasFlowSubmissions = Boolean(Array.isArray(details.flowSubmissions) && details.flowSubmissions.length);
  const hasStructuredAnswers = ['packageEnquiry', 'propertyEnquiry', 'serviceEnquiry', 'visaEnquiry', 'cruiseEnquiry', 'customTripEnquiry', 'flowEnquiry']
    .some((key) => details[key]?.answers && Object.keys(details[key].answers).length);

  return Boolean(
    details.serviceCategory
    || details.service
    || details.serviceDetails
    || details.propertyName
    || details.propertyLocation
    || details.propertyType
    || details.stayType
    || details.destination
    || details.checkInDate
    || details.checkOutDate
    || details.groupType
    || details.adults
    || details.children6To12
    || details.childrenBelow5
    || details.rooms
    || details.travelDate
    || details.travellersText
    || details.travellers
    || details.budgetText
    || details.budgetPerPerson
    || details.campaignName
    || details.submittedAt
    || details.notes
    || details.staycationInterest
    || hasFlowAnswers
    || hasFlowSubmissions
    || hasStructuredAnswers
  );
}

const FLOW_ANSWER_LABELS = {
  from: 'From',
  to: 'To',
  destination: 'Destination',
  where: 'Where',
  city: 'City',
  propertyType: 'Stay Type',
  stayType: 'Stay Type',
  groupType: 'Group Type',
  checkInDate: 'Check-in',
  checkOutDate: 'Checkout',
  travelDate: 'Travel Date',
  date: 'Date',
  when: 'When',
  people: 'People',
  travellers: 'Travellers',
  passengers: 'Passengers',
  guests: 'Guests',
  adults: 'Adults',
  children6To12: 'Children 6-12',
  childrenBelow5: 'Children Below 5',
  rooms: 'Rooms',
  budget: 'Budget',
  notes: 'Notes',
};

function formatFlowAnswerLabel(key = '') {
  if (FLOW_ANSWER_LABELS[key]) return FLOW_ANSWER_LABELS[key];
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanAnswerEntries(answers = {}) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return [];
  const hiddenKeys = new Set(['selectedItemType', 'selectedItemId', 'selectedItemName', 'token', 'flow_token', 'flowToken']);
  return Object.entries(answers)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .filter(([key]) => !hiddenKeys.has(key))
    .map(([key, value]) => [formatFlowAnswerLabel(key), String(value).trim()]);
}

function pickAnswers(answers = {}, keys = []) {
  return keys.reduce((picked, key) => {
    if (answers[key] !== undefined && answers[key] !== null && String(answers[key]).trim()) {
      picked[key] = answers[key];
    }
    return picked;
  }, {});
}

function splitLegacyFlowAnswers(details = {}) {
  const answers = details.flowAnswers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return [];

  const sections = [];
  const hasPropertyAnswers = Boolean(answers.destination || answers.propertyType || answers.checkInDate || answers.checkOutDate || answers.rooms);
  const serviceAnswers = pickAnswers(
    answers,
    hasPropertyAnswers
      ? ['from', 'to', 'travelDate', 'passengers']
      : ['from', 'to', 'travelDate', 'people', 'passengers', 'travellers', 'notes']
  );
  const propertyAnswers = pickAnswers(answers, ['destination', 'propertyType', 'checkInDate', 'checkOutDate', 'rooms', 'people', 'guests', 'notes']);

  if (Object.keys(serviceAnswers).length) {
    sections.push({
      key: 'legacy-service-answers',
      title: 'Service Answers',
      subtitle: answers.selectedItemName || details.serviceEnquiry?.itemName || details.serviceEnquiry?.name || '',
      entries: cleanAnswerEntries(serviceAnswers),
    });
  }

  if (Object.keys(propertyAnswers).length) {
    sections.push({
      key: 'legacy-property-answers',
      title: 'Property Answers',
      subtitle: details.propertyEnquiry?.itemName || details.propertyEnquiry?.name || details.propertyName || '',
      entries: cleanAnswerEntries(propertyAnswers),
    });
  }

  if (!sections.length) {
    const fallbackEntries = cleanAnswerEntries(answers);
    if (fallbackEntries.length) {
      sections.push({
        key: 'flowAnswers',
        title: 'Flow Answers',
        subtitle: answers.selectedItemName || '',
        entries: fallbackEntries,
      });
    }
  }

  return sections;
}

function getFlowAnswerSections(details = {}) {
  const submissionSections = Array.isArray(details.flowSubmissions)
    ? details.flowSubmissions
      .map((submission, index) => {
        const entries = cleanAnswerEntries(submission.answers);
        if (!entries.length) return null;
        return {
          key: `flow-submission-${index}-${submission.submittedAt || ''}`,
          title: submission.title || 'Flow Answers',
          subtitle: submission.itemName || submission.category || '',
          entries,
        };
      })
      .filter(Boolean)
    : [];
  if (submissionSections.length) return submissionSections;

  const configs = [
    ['serviceEnquiry', 'Service Answers'],
    ['packageEnquiry', 'Package Answers'],
    ['propertyEnquiry', 'Property Answers'],
    ['visaEnquiry', 'Visa Answers'],
    ['cruiseEnquiry', 'Cruise Answers'],
    ['customTripEnquiry', 'Custom Trip Answers'],
    ['flowEnquiry', 'Flow Answers'],
  ];

  const sections = configs
    .map(([key, title]) => {
      const enquiry = details[key];
      const entries = cleanAnswerEntries(enquiry?.answers);
      if (!entries.length) return null;
      return {
        key,
        title,
        subtitle: enquiry.itemName || enquiry.name || enquiry.category || enquiry.propertyType || enquiry.country || '',
        entries,
      };
    })
    .filter(Boolean);

  if (sections.length === 0) {
    sections.push(...splitLegacyFlowAnswers(details));
  }

  return sections;
}

function getLeadRequestSummaries(lead, details = {}) {
  if (!lead) return [];
  const notes = String(lead.notes || '').toLowerCase();
  const summaries = [];
  const readinessDetails = details.travelReadiness || {};
  const serviceAnswers = details.serviceEnquiry?.answers || {};
  const propertyAnswers = details.propertyEnquiry?.answers || {};
  const isCustomTripRequest = String(lead.itemType || '').toUpperCase() === 'CUSTOM_TRIP'
    || String(lead.interest || '').toUpperCase().includes('CUSTOM_TRIP')
    || notes.includes('custom trip');
  const isPropertyRequest = Boolean(
    lead.propertyId
    || details.propertyName
    || details.propertyLocation
    || details.checkInDate
    || details.checkOutDate
    || String(details.source || '').includes('property')
  );

  if (details.serviceCategory || details.service || details.serviceEnquiry || String(lead.interest || '').includes('TICKETING')) {
    summaries.push({
      key: 'ticketing',
      title: 'Visa & Ticketing',
      tone: 'border-sky-200 bg-sky-50 text-sky-700',
      meta: [
        details.serviceEnquiry?.itemName || details.serviceEnquiry?.name || formatServiceLabel(details.service || lead.interest?.replace('_TICKETING', '')),
        serviceAnswers.from && serviceAnswers.to ? `${serviceAnswers.from} to ${serviceAnswers.to}` : '',
        serviceAnswers.travelDate || '',
        serviceAnswers.people ? `${serviceAnswers.people} people` : '',
        details.serviceDetails || '',
      ].filter(Boolean).join(' - ') || 'Service enquiry captured',
    });
  }

  if (details.staycationInterest || notes.includes('properties viewed from whatsapp menu') || isPropertyRequest) {
    const stayMeta = [
      details.propertyName || lead.property?.name,
      details.propertyLocation || propertyAnswers.destination || details.destination || lead.destination,
      (details.checkInDate || propertyAnswers.checkInDate) ? `Check-in ${details.checkInDate || propertyAnswers.checkInDate}` : '',
      (details.checkOutDate || propertyAnswers.checkOutDate) ? `Checkout ${details.checkOutDate || propertyAnswers.checkOutDate}` : '',
      propertyAnswers.people || details.travellersText || (details.travellers ? `${details.travellers} guests` : ''),
    ].filter(Boolean).join(' - ');

    summaries.push({
      key: 'staycations',
      title: 'Staycations',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      meta: stayMeta || (lead.property?.name ? `Selected ${lead.property.name}` : 'Opened stay/property flow'),
    });
  }

  if (readinessDetails.travellerCount || readinessDetails.bookingReadiness || readinessDetails.departureAirport || notes.includes('travel readiness questionnaire submitted')) {
    const readinessMeta = [
      lead.package?.name,
      readinessDetails.travellerCount ? `${formatReadinessAnswer(readinessDetails.travellerCount)} traveller${String(readinessDetails.travellerCount).trim() === '1' ? '' : 's'}` : '',
      readinessDetails.bookingReadiness ? formatReadinessAnswer(readinessDetails.bookingReadiness) : '',
      readinessDetails.departureAirport ? `From ${formatReadinessAnswer(readinessDetails.departureAirport)}` : '',
    ].filter(Boolean).join(' - ');

    summaries.push({
      key: 'travel-readiness',
      title: 'Availability Check',
      tone: 'border-violet-200 bg-violet-50 text-violet-700',
      meta: readinessMeta || 'Questionnaire submitted',
    });
  }

  if (details.stayrouteOnam?.travellerCount || details.stayrouteOnam?.departureAirport || details.stayrouteOnam?.roomType) {
    const onamMeta = [
      details.stayrouteOnam.travellerCount ? `${formatReadinessAnswer(details.stayrouteOnam.travellerCount)} travellers` : '',
      details.stayrouteOnam.departureAirport ? `From ${formatReadinessAnswer(details.stayrouteOnam.departureAirport)}` : '',
      details.stayrouteOnam.roomType ? formatReadinessAnswer(details.stayrouteOnam.roomType) : '',
    ].filter(Boolean).join(' - ');

    summaries.push({
      key: 'stayroute-onam',
      title: 'Onam Trip',
      tone: 'border-teal-200 bg-teal-50 text-teal-700',
      meta: onamMeta || 'Questionnaire submitted',
    });
  }

  if (!isPropertyRequest && (
    details.destination
    || details.travelDate
    || details.travellers
    || details.budgetPerPerson
    || readinessDetails.travellerCount
    || isCustomTripRequest
  )) {
    summaries.push({
      key: 'custom-trip',
      title: 'Custom Trip',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
      meta: [
        details.destination,
        details.travelDate,
        details.travellersText
          || (details.travellers ? `${details.travellers} travellers` : '')
          || (readinessDetails.travellerCount ? `${formatReadinessAnswer(readinessDetails.travellerCount)} travellers` : ''),
      ].filter(Boolean).join(' - ') || 'Custom trip flow submitted',
    });
  }

  return summaries;
}

export default function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('Needs Attention');
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isStatsDrawerOpen, setIsStatsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [adFilter, setAdFilter] = useState('all');
  const [sortBy, setSortBy] = useState('overdue');
  const [dateRange, setDateRange] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningLead, setAssigningLead] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusLead, setStatusLead] = useState(null);
  const [followupLead, setFollowupLead] = useState(null);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportType, setExportType] = useState(null);
  useEffect(() => {
    const tab = searchParams.get('tab');
    const q = searchParams.get('q');
    const source = searchParams.get('source');
    const ad = searchParams.get('ad');
    const sort = searchParams.get('sort');
    const range = searchParams.get('range');
    const agent = searchParams.get('agent');
    const tag = searchParams.get('tag');
    const channel = searchParams.get('channel');
    const viewParam = searchParams.get('view');
    const page = Number(searchParams.get('page') || 1);
    const size = Number(searchParams.get('size') || PAGE_SIZE_DEFAULT);

    if (tab) setActiveTab(tab);
    if (q) setSearch(q);
    if (source) setSourceFilter(source);
    if (ad) setAdFilter(ad);
    if (sort) setSortBy(sort);
    if (range) setDateRange(range);
    if (agent) setAgentFilter(agent);
    if (tag) setTagFilter(tag);
    if (channel) setChannelFilter(channel);
    if (viewParam === 'list' || viewParam === 'kanban') setView(viewParam);
    if (Number.isInteger(page) && page > 0) setCurrentPage(page);
    if (PAGE_SIZE_OPTIONS.includes(size)) setPageSize(size);
    // Only hydrate from URL once on initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const currentAgent = useAuthStore((state) => state.agent);
  const stagesQuery = usePipelineStages();
  const stages = useMemo(() => stagesQuery.data?.data || [], [stagesQuery.data]);
  const activeStages = useMemo(() => stages.filter((stage) => stage.isActive), [stages]);
  const TABS = useMemo(
    () => [...BASE_TABS, ...activeStages.map((stage) => ({ key: stage.id, label: stage.name }))],
    [activeStages]
  );

  const leadQueryParams = useMemo(() => {
    const params = {
      page: currentPage,
      pageSize,
      sortBy,
    };
    if (activeTab === 'Needs Attention') params.attention = true;
    else if (activeTab !== 'All Leads') params.pipelineStageId = activeTab;
    if (search.trim()) params.search = search.trim();
    if (sourceFilter !== 'all') params.source = sourceFilter;
    if (adFilter !== 'all') params.adId = adFilter;
    if (dateRange !== 'all') params.dateRange = dateRange;
    if (agentFilter !== 'all') params.agentId = agentFilter;
    if (tagFilter !== 'all') params.tag = tagFilter;
    if (channelFilter !== 'all') params.channelId = channelFilter;
    return params;
  }, [activeTab, adFilter, agentFilter, currentPage, dateRange, pageSize, search, sortBy, sourceFilter, tagFilter, channelFilter]);
  const leadsQuery = useLeads(leadQueryParams);
  const leadsResponse = leadsQuery.data?.data || {};
  const leads = leadsResponse.data || [];
  const totalItems = Number(leadsResponse.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  // Ad filter options come straight from the leads-by-ad report: every Click-to-WhatsApp
  // ad that has produced at least one lead, labelled with its resolved name (or headline).
  // Users never type an ad name — they pick from this auto-built list.
  const { data: adReport } = useLeadsByAdReport({});
  const adOptions = useMemo(() => (adReport?.data?.ads || [])
    .map((a) => ({ value: a.adId, label: getAdOptionBaseLabel(a), leads: a.leads }))
    .sort((a, b) => (b.leads || 0) - (a.leads || 0)), [adReport]);

  const { data: agentsResponse } = useQuery({
    queryKey: ['agents'],
    queryFn: () => client.get('/agents').then((response) => response.data),
  });
  const agents = agentsResponse?.data || [];
  const whatsappChannelsQuery = useQuery({
    queryKey: ['whatsapp-channels'],
    queryFn: () => client.get('/agencies/me/whatsapp-channels').then((res) => res.data.data),
  });
  const whatsappChannels = Array.isArray(whatsappChannelsQuery.data) ? whatsappChannelsQuery.data : [];
  const updateLead = useUpdateLead();
  const bulkAssign = useBulkAssignLeads();
  const bulkDelete = useBulkDeleteLeads();
  const addFollowup = useAddFollowUp();
  const tagOptions = useMemo(() => {
    const tags = new Set();
    leads.forEach((lead) => (lead.tags || []).forEach((tag) => tags.add(tag)));
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const toggleSelectLead = useCallback((leadId) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const handleBulkAssign = useCallback((agentId) => {
    if (selectedLeadIds.size === 0) return;
    bulkAssign.mutate(
      { leadIds: [...selectedLeadIds], agentId: agentId || null },
      { onSuccess: () => setSelectedLeadIds(new Set()) }
    );
  }, [selectedLeadIds, bulkAssign]);

  const handleBulkDelete = useCallback(() => {
    const count = selectedLeadIds.size;
    if (count === 0) return;
    const label = count === 1 ? 'lead' : 'leads';
    const confirmed = window.confirm(`Delete ${count} selected ${label}? This will mark ${label} as cancelled.`);
    if (!confirmed) return;

    bulkDelete.mutate([...selectedLeadIds], {
      onSuccess: () => setSelectedLeadIds(new Set()),
      onError: (error) => window.alert(error?.message || 'Could not delete selected leads'),
    });
  }, [bulkDelete, selectedLeadIds]);

  const handleExportExcel = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const exportedLeads = [];
      let page = 1;
      let total = 0;

      while (page <= MAX_EXPORT_PAGES) {
        const response = await client.get('/leads', {
          params: {
            ...leadQueryParams,
            page,
            pageSize: EXPORT_PAGE_SIZE,
          },
        });
        const payload = response.data?.data || {};
        const pageLeads = payload.data || [];
        exportedLeads.push(...pageLeads);
        total = Number(payload.total || exportedLeads.length);

        if (pageLeads.length === 0 || exportedLeads.length >= total) break;
        page += 1;
      }

      if (exportedLeads.length === 0) {
        window.alert('No leads match the current filters.');
        return;
      }

      const rows = getLeadExportRows(exportedLeads);
      downloadExcelFile(`leads-export-${new Date().toISOString().slice(0, 10)}.xls`, rows);
    } catch (error) {
      window.alert(error?.response?.data?.message || error?.message || 'Could not export leads');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, leadQueryParams]);

  const handleExportReport = useCallback(async (type) => {
    if (isExporting) return;
    setIsExporting(true);
    setExportType(type);
    setShowExportMenu(false);

    try {
      const params = { ...leadQueryParams };
      delete params.page;
      delete params.pageSize;

      const response = type === 'pdf'
        ? await client.get('/leads/export/pdf', { params, responseType: 'blob', timeout: 120000 })
        : await client.get('/leads/export/excel', { params, responseType: 'blob', timeout: 120000 });

      const blob = response.data;
      const ext = type === 'pdf' ? 'pdf' : 'xlsx';
      const mimeType = type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `lead-report-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error?.response?.data?.message || error?.message || `Could not export ${type.toUpperCase()} report`);
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  }, [isExporting, leadQueryParams]);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e) => {
      if (e.target.closest('.export-menu-container')) return;
      setShowExportMenu(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showExportMenu]);

  const tabCounts = useMemo(() => {
    const counts = leadsResponse.counts || {};
    return {
      'Needs Attention': counts['Needs Attention'] ?? 0,
      'All Leads': counts['All Leads'] ?? totalItems,
      ...activeStages.reduce((acc, stage) => {
        acc[stage.id] = counts[stage.id] ?? 0;
        return acc;
      }, {}),
    };
  }, [leadsResponse.counts, totalItems, activeStages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, adFilter, agentFilter, dateRange, search, sortBy, sourceFilter, tagFilter, channelFilter, view, pageSize]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (activeTab !== 'Needs Attention') params.set('tab', activeTab);
    if (search.trim()) params.set('q', search.trim());
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (adFilter !== 'all') params.set('ad', adFilter);
    if (sortBy !== 'overdue') params.set('sort', sortBy);
    if (dateRange !== 'all') params.set('range', dateRange);
    if (agentFilter !== 'all') params.set('agent', agentFilter);
    if (tagFilter !== 'all') params.set('tag', tagFilter);
    if (channelFilter !== 'all') params.set('channel', channelFilter);
    if (view !== 'list') params.set('view', view);
    if (safeCurrentPage > 1) params.set('page', String(safeCurrentPage));
    if (pageSize !== PAGE_SIZE_DEFAULT) params.set('size', String(pageSize));

    setSearchParams(params, { replace: true });
  }, [
    activeTab,
    agentFilter,
    dateRange,
    pageSize,
    safeCurrentPage,
    search,
    setSearchParams,
    sortBy,
    sourceFilter,
    adFilter,
    tagFilter,
    channelFilter,
    view,
  ]);

  const metrics = useMemo(() => {
    const attention = leads.filter(needsAttention);
    const overdue = leads.filter((lead) =>
      getAttentionBadges(lead).some((badge) => badge.key === 'overdue')
    );
    const pipelineValue = leads.reduce((total, lead) => {
      const travellers = Number(lead.travellers || 1);
      return total + Number(lead.budgetPerPerson || 0) * travellers;
    }, 0);

    return {
      totalDeals: leadsResponse.metrics?.totalDeals ?? totalItems,
      attention: leadsResponse.metrics?.attention ?? attention.length,
      overdue: overdue.length,
      won: leadsResponse.metrics?.won ?? leads.filter((lead) => lead.status === 'CONVERTED').length,
      lost: leadsResponse.metrics?.lost ?? leads.filter((lead) => lead.status === 'LOST').length,
      hot: leads.filter((lead) => getLeadScore(lead) >= 75 && !['CONVERTED', 'LOST', 'CANCELLED'].includes(lead.status)).length,
      pipelineValue,
    };
  }, [leads, leadsResponse.metrics, totalItems]);

  const toggleSelectAll = useCallback(() => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      const pageLeadIds = leads.map((lead) => lead.id);
      const allSelectedOnPage = pageLeadIds.length > 0 && pageLeadIds.every((id) => next.has(id));

      if (allSelectedOnPage) {
        pageLeadIds.forEach((id) => next.delete(id));
      } else {
        pageLeadIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }, [leads]);

  function clearFilters() {
    setSearch('');
    setActiveTab('All Leads');
    setSourceFilter('all');
    setAdFilter('all');
    setSortBy('newest');
    setDateRange('all');
    setAgentFilter('all');
    setTagFilter('all');
    setChannelFilter('all');
    setCurrentPage(1);
    setPageSize(PAGE_SIZE_DEFAULT);
  }

  function updateLeadField(leadId, data) {
    updateLead.mutate({ id: leadId, data });
  }

  // Moving a lead to a stage writes pipelineStageId (the source of truth); the
  // backend keeps the internal status in sync. Lost-kind stages need a reason.
  function handleStageChange(lead, stageId) {
    if (!stageId) {
      updateLeadField(lead.id, { pipelineStageId: null });
      return;
    }
    const stage = stages.find((item) => item.id === stageId);
    if (stage?.kind === 'LOST' && !lead.lostReason) {
      const lostReason = window.prompt('Why was this lead lost?');
      if (!lostReason?.trim()) return;
      updateLeadField(lead.id, { pipelineStageId: stageId, lostReason: lostReason.trim() });
      return;
    }
    updateLeadField(lead.id, { pipelineStageId: stageId });
  }

  function openFollowupScheduler(lead) {
    setFollowupLead(lead);
    setFollowupDate(getDefaultFollowupDateTime());
    setFollowupNote('');
  }

  function closeFollowupScheduler() {
    setFollowupLead(null);
    setFollowupDate('');
    setFollowupNote('');
  }

  function handleScheduleFollowup(event) {
    event.preventDefault();
    if (!followupLead || !followupDate || !followupNote.trim()) return;

    addFollowup.mutate(
      {
        id: followupLead.id,
        data: {
          scheduledAt: new Date(followupDate).toISOString(),
          note: followupNote.trim(),
        },
      },
      {
        onSuccess: closeFollowupScheduler,
      }
    );
  }

  return (
    <div className={`min-w-0 w-full overflow-x-hidden ${selectedLeadIds.size > 0 ? 'pb-24' : 'pb-10'}`}>
      {/* ── Header ── */}
      <div className="mb-4 md:hidden">
        <div className="sr-only">Leads</div>

        {/* Mobile quick actions */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setIsStatsDrawerOpen(true)}
              className="shell-button-secondary h-10 flex-none px-4 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50"
            >
              Summary
            </button>

            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="shell-button-secondary h-10 flex-none px-4 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 md:hidden"
            >
              <FunnelIcon className="h-4 w-4 inline mr-2" />
              Filter
            </button>
          </div>

          <div className="export-menu-container relative z-50 flex-none">
            <button
              onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
              disabled={isExporting || leadsQuery.isLoading}
              className="shell-button-secondary flex items-center h-10 flex-none rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60"
            >
              {isExporting ? <ArrowPathIcon className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" />}
              {isExporting ? (exportType === 'pdf' ? 'PDF...' : 'Excel...') : 'Export'}
              <ChevronDownIcon className="ml-1 h-4 w-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
                <button onClick={() => handleExportReport('pdf')} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500"><ArrowDownTrayIcon className="h-4 w-4" /></span>
                  <div><div className="text-sm font-semibold">PDF Report</div><div className="text-xs text-neutral-400">Full report with all details</div></div>
                </button>
                <div className="border-t border-neutral-100" />
                <button onClick={() => handleExportReport('excel')} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600"><ArrowDownTrayIcon className="h-4 w-4" /></span>
                  <div><div className="text-sm font-semibold">Excel Report</div><div className="text-xs text-neutral-400">Multi-sheet with notes & follow-ups</div></div>
                </button>
                <div className="border-t border-neutral-100" />
                <button onClick={() => { setShowExportMenu(false); handleExportExcel(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500"><ArrowDownTrayIcon className="h-4 w-4" /></span>
                  <div><div className="text-sm font-semibold">Quick Excel</div><div className="text-xs text-neutral-400">Basic lead list export</div></div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsNewLeadModalOpen(true)}
            className="shell-button-primary h-10 flex-none px-4 rounded-xl text-sm font-semibold bg-neutral-900 hover:bg-black flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      {/* ── Metrics ── */}
      <div className="mb-5 hidden min-w-0 lg:grid -mx-1 gap-3 overflow-x-auto pb-1 hide-scrollbar md:mx-0 md:mb-6 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={ExclamationTriangleIcon} tone="bg-amber-50 text-amber-600" value={metrics.attention} label="Attention" />
        <MetricCard icon={ClockIcon} tone="bg-rose-50 text-rose-600" value={metrics.overdue} label="Overdue" />
        <MetricCard icon={TrophyIcon} tone="bg-red-50 text-red-600" value={metrics.hot} label="Hot" />
        <MetricCard icon={BriefcaseIcon} tone="bg-sky-50 text-sky-600" value={metrics.totalDeals} label="Total" />
        <MetricCard icon={TrophyIcon} tone="bg-emerald-50 text-emerald-600" value={metrics.won} label="Won" />
        <MetricCard icon={BanknotesIcon} tone="bg-indigo-50 text-indigo-600" value={formatCurrency(metrics.pipelineValue)} label="Pipeline" />
      </div>

      {/* ── Search + Tabs ── */}
      <div className="mb-4 flex flex-col gap-3 md:mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center xl:flex-nowrap">
          <div className="relative w-full group md:max-w-xs md:flex-1 xl:max-w-[450px]">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search name, phone, destination..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="shell-input-rect h-10 rounded-xl border-neutral-200 bg-white pl-10 text-sm shadow-sm focus:border-neutral-400 focus:ring-0 md:h-12 md:pl-11"
            />
          </div>
          <div className="hidden min-w-0 flex-1 items-center gap-3 overflow-x-auto pb-1 hide-scrollbar md:flex">
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="shell-input-rect h-12 w-32 flex-none bg-white py-2 text-sm lg:w-40">
              {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {adOptions.length > 0 && (
              <select value={adFilter} onChange={(e) => setAdFilter(e.target.value)} className="shell-input-rect h-12 w-36 flex-none bg-white py-2 text-sm lg:w-48" title="Filter by the Meta ad a lead came from">
                <option value="all">All Ads</option>
                <option value="any">Any ad (CTWA)</option>
                {adOptions.map((o) => <option key={o.value} value={o.value}>{formatAdOptionLabel(o)}</option>)}
              </select>
            )}
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="shell-input-rect h-12 w-36 flex-none bg-white py-2 text-sm lg:w-44">
              <option value="all">All Staff</option>
              {currentAgent?.id && <option value="mine">Assigned To Me</option>}
              <option value="unassigned">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="shell-input-rect h-12 w-32 flex-none bg-white py-2 text-sm lg:w-40">
              <option value="all">All Labels</option>
              {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {whatsappChannels.length > 0 && (
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="shell-input-rect h-12 w-36 flex-none bg-white py-2 text-sm lg:w-44">
                <option value="all">All Channels</option>
                {whatsappChannels.map((c) => <option key={c.id} value={c.id}>{c.label || c.displayPhoneNumber || c.whatsappNumber}</option>)}
              </select>
            )}
            <button onClick={clearFilters} className="shell-button-secondary h-11 px-3 text-xs">
              <FunnelIcon className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
          <div className="hidden items-center gap-3 md:flex flex-none">
            <div className="export-menu-container relative z-50">
              <button
                onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                disabled={isExporting || leadsQuery.isLoading}
                className="shell-button-secondary flex items-center h-11 flex-none gap-1.5 px-3 text-xs disabled:opacity-60"
              >
                {isExporting ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownTrayIcon className="h-3.5 w-3.5" />}
                {isExporting
                  ? exportType === 'pdf' ? 'Generating PDF...' : exportType === 'excel' ? 'Generating Excel...' : 'Exporting...'
                  : 'Export Report'}
                <ChevronDownIcon className="ml-0.5 h-3.5 w-3.5" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
                  <button onClick={() => handleExportReport('pdf')} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-red-50 text-red-500"><ArrowDownTrayIcon className="h-4 w-4" /></span>
                    <div><div className="text-sm font-semibold">PDF Report</div><div className="text-xs text-neutral-400">Full report with all details</div></div>
                  </button>
                  <div className="border-t border-neutral-100" />
                  <button onClick={() => handleExportReport('excel')} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-green-50 text-green-600"><ArrowDownTrayIcon className="h-4 w-4" /></span>
                    <div><div className="text-sm font-semibold">Excel Report</div><div className="text-xs text-neutral-400">Multi-sheet with notes & follow-ups</div></div>
                  </button>
                  <div className="border-t border-neutral-100" />
                  <button onClick={() => { setShowExportMenu(false); handleExportExcel(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-500"><ArrowDownTrayIcon className="h-4 w-4" /></span>
                    <div><div className="text-sm font-semibold">Quick Excel</div><div className="text-xs text-neutral-400">Basic lead list export</div></div>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsNewLeadModalOpen(true)}
              className="shell-button-primary ml-auto h-11 flex-none rounded-xl bg-neutral-900 px-4 text-sm font-semibold hover:bg-black"
            >
              <PlusIcon className="h-4 w-4" />
              Add Lead
            </button>
          </div>
        </div>

        <div className="flex gap-0.5 overflow-x-auto hide-scrollbar border-b border-neutral-100">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors md:px-4 md:text-sm ${
                activeTab === tab.key
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-500 md:text-[10px] md:px-2">
                {tabCounts[tab.key] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {view === 'kanban' ? (
        <LeadPipeline leads={leads} onLeadClick={(lead) => setSelectedLeadId(lead.id)} />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden">
            {leadsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-neutral-100" />
                      <div className="flex-1 space-y-1.5"><div className="h-3.5 w-2/3 rounded bg-neutral-100" /><div className="h-2.5 w-1/3 rounded bg-neutral-100" /></div>
                    </div>
                    <div className="space-y-2"><div className="h-3 w-full rounded bg-neutral-100" /><div className="h-3 w-1/2 rounded bg-neutral-100" /></div>
                  </div>
                ))}
              </div>
            ) : leadsQuery.isError ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-neutral-200 bg-white">
                <XCircleIcon className="h-10 w-10 text-rose-400 mb-3" />
                <p className="text-sm font-semibold text-neutral-700">Could not load leads</p>
                <button onClick={() => leadsQuery.refetch()} className="shell-button-secondary mt-4 text-xs"><ArrowPathIcon className="h-4 w-4" /> Retry</button>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-neutral-200 bg-white">
                <BriefcaseIcon className="h-10 w-10 text-neutral-300 mb-3" />
                <p className="text-sm font-semibold text-neutral-700">No leads found</p>
                <button onClick={clearFilters} className="mt-3 text-xs font-bold text-neutral-600 underline">Clear filters</button>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    agents={agents}
                    isSelected={selectedLeadIds.has(lead.id)}
                    onToggleSelect={() => toggleSelectLead(lead.id)}
                    onClick={(l) => setSelectedLeadId(l.id)}
                    onAssignAgent={(leadId, agentId) => updateLeadField(leadId, { assignedAgentId: agentId || null })}
                    onAssignClick={(l) => { setAssigningLead(l); setIsAssignModalOpen(true); }}
                    onStatusClick={(l) => { setStatusLead(l); setIsStatusModalOpen(true); }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden min-w-0 md:block">
            <LeadTable
              agents={agents}
              clearFilters={clearFilters}
              isError={leadsQuery.isError}
              isLoading={leadsQuery.isLoading}
              leads={leads}
              onLeadClick={(lead) => setSelectedLeadId(lead.id)}
              onRetry={() => leadsQuery.refetch()}
              onScheduleFollowUp={openFollowupScheduler}
              onStatusChange={handleStageChange}
              onUpdateLead={updateLeadField}
              stages={activeStages}
              selectedLeadIds={selectedLeadIds}
              onToggleSelect={toggleSelectLead}
              onToggleSelectAll={toggleSelectAll}
            />
          </div>
        </>
      )}

      {!leadsQuery.isLoading && !leadsQuery.isError && totalItems > 0 && (
        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemLabel="leads"
        />
      )}

      <BulkActionBar
        agents={agents}
        count={selectedLeadIds.size}
        isDeleting={bulkDelete.isPending}
        isPending={bulkAssign.isPending}
        onAssign={handleBulkAssign}
        onClear={() => setSelectedLeadIds(new Set())}
        onDelete={handleBulkDelete}
      />

      {/* Assign modal (mobile & desktop) */}
      {isAssignModalOpen && assigningLead && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsAssignModalOpen(false)} />
          <div className="relative z-10 w-[90%] max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900">Assign Lead</h3>
            <p className="text-sm text-neutral-500 mt-1">Assign "{assigningLead.customer?.name || 'Unnamed'}" to staff</p>
            <div className="mt-4">
              <select className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm" defaultValue={assigningLead.assignedAgentId || ''} onChange={(e) => {
                const agentId = e.target.value || null;
                updateLeadField(assigningLead.id, { assignedAgentId: agentId });
                setIsAssignModalOpen(false);
              }}>
                <option value="">Unassigned</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="shell-button-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Status modal */}
      {isStatusModalOpen && statusLead && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsStatusModalOpen(false)} />
          <div className="relative z-10 w-[90%] max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900">Update Status</h3>
            <p className="text-sm text-neutral-500 mt-1">Change status for "{statusLead.customer?.name || 'Unnamed'}"</p>
            <div className="mt-4">
              <select className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm" defaultValue={statusLead.pipelineStageId || ''} onChange={(e) => {
                handleStageChange(statusLead, e.target.value || null);
                setIsStatusModalOpen(false);
              }}>
                <option value="">No status</option>
                {activeStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsStatusModalOpen(false)} className="shell-button-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {followupLead && (
        <FollowupScheduleModal
          followupDate={followupDate}
          followupNote={followupNote}
          isSaving={addFollowup.isPending}
          lead={followupLead}
          onClose={closeFollowupScheduler}
          onDateChange={setFollowupDate}
          onNoteChange={setFollowupNote}
          onSubmit={handleScheduleFollowup}
        />
      )}

      <LeadDrawer
        agents={agents}
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />

      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        agents={agents}
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        adFilter={adFilter}
        setAdFilter={setAdFilter}
        adOptions={adOptions}
        agentFilter={agentFilter}
        setAgentFilter={setAgentFilter}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        dateRange={dateRange}
        setDateRange={setDateRange}
        agents={agents}
        tagOptions={tagOptions}
        currentAgent={currentAgent}
        clearFilters={clearFilters}
      />

      <StatsDrawer
        isOpen={isStatsDrawerOpen}
        onClose={() => setIsStatsDrawerOpen(false)}
        metrics={metrics}
      />
    </div>
  );
}

function FilterDrawer({ isOpen, onClose, sourceFilter, setSourceFilter, adFilter, setAdFilter, adOptions = [], agentFilter, setAgentFilter, tagFilter, setTagFilter, sortBy, setSortBy, dateRange, setDateRange, agents, tagOptions, currentAgent, clearFilters }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full bg-white flex flex-col shadow-2xl animate-slide-up rounded-t-2xl max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-neutral-500" /> Filter Leads
          </h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Source</label>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="shell-input-rect w-full h-11 bg-neutral-50 text-sm">
              {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {adOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Source Ad</label>
              <select value={adFilter} onChange={(e) => setAdFilter(e.target.value)} className="shell-input-rect w-full h-11 bg-neutral-50 text-sm">
                <option value="all">All Ads</option>
                <option value="any">Any ad (CTWA)</option>
                {adOptions.map((o) => <option key={o.value} value={o.value}>{formatAdOptionLabel(o)}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Staff</label>
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="shell-input-rect w-full h-11 bg-neutral-50 text-sm">
              <option value="all">All Staff</option>
              {currentAgent?.id && <option value="mine">Assigned To Me</option>}
              <option value="unassigned">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Labels</label>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="shell-input-rect w-full h-11 bg-neutral-50 text-sm">
              <option value="all">All Labels</option>
              {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t border-neutral-100 p-4 flex gap-3 bg-neutral-50/50 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button 
            onClick={() => { clearFilters(); onClose(); }} 
            className="flex-1 shell-button-secondary h-11 text-sm bg-white"
          >
            Clear
          </button>
          <button 
            onClick={onClose} 
            className="flex-1 shell-button-primary h-11 text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsDrawer({ isOpen, onClose, metrics }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end md:hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-[85%] max-w-sm bg-neutral-50 h-full flex flex-col shadow-2xl animate-fade-in-right">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5 text-neutral-500" /> Lead Stats
          </h2>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <MetricCard icon={ExclamationTriangleIcon} tone="bg-amber-50 text-amber-600 border border-amber-100 shadow-sm" value={metrics.attention} label="Attention" fullWidth />
          <MetricCard icon={ClockIcon} tone="bg-rose-50 text-rose-600 border border-rose-100 shadow-sm" value={metrics.overdue} label="Overdue" fullWidth />
          <MetricCard icon={TrophyIcon} tone="bg-red-50 text-red-600 border border-red-100 shadow-sm" value={metrics.hot} label="Hot" fullWidth />
          <MetricCard icon={BriefcaseIcon} tone="bg-sky-50 text-sky-600 border border-sky-100 shadow-sm" value={metrics.totalDeals} label="Total Leads" fullWidth />
          <MetricCard icon={TrophyIcon} tone="bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm" value={metrics.won} label="Won" fullWidth />
          <MetricCard icon={BanknotesIcon} tone="bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm" value={formatCurrency(metrics.pipelineValue)} label="Pipeline" fullWidth />
        </div>
      </div>
    </div>
  );
}

function FollowupScheduleModal({
  followupDate,
  followupNote,
  isSaving,
  lead,
  onClose,
  onDateChange,
  onNoteChange,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Schedule Follow-Up</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {lead.customer?.name || 'Unnamed Lead'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Date & Time</span>
            <input
              type="datetime-local"
              required
              value={followupDate}
              onChange={(event) => onDateChange(event.target.value)}
              className="shell-input-rect h-11 w-full bg-neutral-50 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Note <span className="text-rose-500">*</span></span>
            <textarea
              required
              rows="3"
              value={followupNote}
              onChange={(event) => onNoteChange(event.target.value)}
              className="shell-input-rect w-full resize-none bg-neutral-50 py-2 text-sm"
              placeholder="Call back regarding package, pricing, or availability"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="shell-button-secondary h-10 px-4 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={isSaving || !followupNote.trim()} className="shell-button-primary h-10 px-5 text-sm disabled:opacity-60">
            {isSaving ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AddNoteModal({ addNote, lead, noteContent, setNoteContent, onClose }) {
  const handleSave = (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    addNote.mutate({ id: lead.id, data: { content: noteContent.trim() } }, {
      onSuccess: () => {
        setNoteContent('');
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSave} className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Add Note</h3>
            <p className="mt-1 text-sm text-neutral-500">{lead.customer?.name || 'Unnamed Lead'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">
          <textarea
            placeholder="Add a new note..."
            className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            rows="4"
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            autoFocus
          />
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="shell-button-secondary h-10 px-4 text-sm">Cancel</button>
          <button type="submit" disabled={addNote.isPending || !noteContent.trim()} className="shell-button-primary h-10 px-5 text-sm disabled:opacity-60">
            {addNote.isPending ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MetricCard({ icon: Icon, tone, value, label, fullWidth }) {
  return (
    <div className={`kpi-card ${fullWidth ? 'w-full bg-white' : 'min-w-[120px] shrink-0 md:min-w-0'}`}>
      <div className="flex items-center gap-3 md:gap-4">
        <div className={`kpi-icon !h-9 !w-9 md:!h-11 md:!w-11 ${tone}`}>
          <Icon className="h-4 w-4 md:h-5 md:w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold leading-none text-neutral-900 md:text-2xl">{value}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 md:mt-1 md:text-[11px]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function LeadTable({ agents, clearFilters, isError, isLoading, leads, onLeadClick, onRetry, onScheduleFollowUp, onStatusChange, onUpdateLead, stages = [], selectedLeadIds, onToggleSelect, onToggleSelectAll }) {
  const selectedOnPage = leads.filter((lead) => selectedLeadIds.has(lead.id)).length;
  const allSelected = leads.length > 0 && selectedOnPage === leads.length;
  const someSelected = selectedOnPage > 0 && selectedOnPage < leads.length;
  const colSpan = 10;

  return (
    <div className="data-table-wrapper">
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <thead>
            <tr className="data-table-head">
              <th className="data-table-th w-12" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={onToggleSelectAll}
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                    allSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : someSelected
                        ? 'border-neutral-900 bg-neutral-200'
                        : 'border-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {allSelected && <CheckIcon className="h-3.5 w-3.5" />}
                  {someSelected && !allSelected && <span className="block h-0.5 w-2.5 rounded bg-neutral-900" />}
                </button>
              </th>
              <th className="data-table-th">Created On</th>
              <th className="data-table-th">Lead</th>
              <th className="data-table-th">Attention</th>
              <th className="data-table-th">Contact</th>
              <th className="data-table-th">Trip</th>
              <th className="data-table-th">Source Ad</th>
              <th className="data-table-th">Next Action</th>
              <th className="data-table-th">Assigned To</th>
              <th className="data-table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <LeadTableSkeleton colSpan={colSpan} />}

            {isError && !isLoading && (
              <tr>
                <td colSpan={colSpan} className="p-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-rose-100 bg-rose-50">
                      <XCircleIcon className="h-8 w-8 text-rose-500" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">Could not load leads</h3>
                    <p className="mt-1 text-sm text-neutral-500">Refresh the data and try again.</p>
                    <button onClick={onRetry} className="shell-button-secondary mt-5">
                      <ArrowPathIcon className="h-4 w-4" />
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !isError && leads.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="p-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-neutral-100 bg-neutral-50 shadow-inner">
                      <BriefcaseIcon className="h-10 w-10 text-neutral-300" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">No leads found</h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                      No lead matches the current search, filters, and tab.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="mt-6 text-sm font-bold text-neutral-900 underline-offset-4 transition-all hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              !isError &&
              leads.map((lead) => (
                <LeadTableRow
                  agents={agents}
                  isSelected={selectedLeadIds.has(lead.id)}
                  key={lead.id}
                  lead={lead}
                  onLeadClick={onLeadClick}
                  onScheduleFollowUp={onScheduleFollowUp}
                  onStatusChange={onStatusChange}
                  onToggleSelect={onToggleSelect}
                  onUpdateLead={onUpdateLead}
                  stages={stages}
                />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* PaginationControls removed — now using shared <Pagination /> component */

function LeadTableSkeleton({ colSpan = 10 }) {
  return Array.from({ length: 5 }).map((_, index) => (
    <tr key={index} className="border-b border-neutral-100">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="h-12 animate-pulse rounded-[var(--radius-md)] bg-neutral-100" />
      </td>
    </tr>
  ));
}

function LeadTableRow({ agents, isSelected, lead, onLeadClick, onScheduleFollowUp, onStatusChange, onToggleSelect, onUpdateLead, stages = [] }) {
  const attentionBadges = getAttentionBadges(lead);
  const nextFollowUp = getNextFollowUp(lead);
  const agentOptions = mergeAssignedAgentOption(agents, lead);

  return (
    <tr className={`data-table-row group ${isSelected ? 'bg-indigo-50/60' : ''}`} onClick={() => onLeadClick(lead)}>
      <td className="data-table-td" onClick={(event) => event.stopPropagation()}>
        <button
          onClick={() => onToggleSelect(lead.id)}
          className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
            isSelected
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-300 hover:border-neutral-500'
          }`}
        >
          {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
        </button>
      </td>
      <td className="data-table-td text-xs font-medium text-neutral-500">{formatDate(lead.createdAt)}</td>
      <td className="data-table-td">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600 ring-1 ring-neutral-200">
            {getInitials(lead.customer?.name, 'L')}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900">{lead.customer?.name || 'Unnamed Lead'}</div>
            <div className="mt-0.5 text-xs text-neutral-400">{formatSource(lead.source)}</div>
          </div>
        </div>
      </td>
      <td className="data-table-td">
        {attentionBadges.length > 0 ? (
          <div className="flex max-w-[220px] flex-wrap gap-1.5">
            {attentionBadges.slice(0, 3).map((badge) => (
              <span
                key={badge.key}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-neutral-300">{EMPTY}</span>
        )}
      </td>
      <td className="data-table-td text-neutral-500">
        <div className="flex flex-col gap-0.5 text-xs">
          <span>{formatPhone(lead.customer?.phone) || EMPTY}</span>
          {lead.customer?.email && <span className="text-neutral-400">{lead.customer.email}</span>}
        </div>
      </td>
      <td className="data-table-td">
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="font-semibold text-neutral-700">{lead.destination || 'Destination not set'}</span>
          <span className="text-neutral-400">{getLeadValueLabel(lead)}</span>
        </div>
      </td>
      <td className="data-table-td">
        {getLeadAdLabel(lead) ? (
          <div className="flex flex-col items-start gap-0.5 text-xs">
            <span className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
              <span className="rounded bg-sky-600 px-1 text-[9px] font-bold uppercase tracking-wide text-white">Ad</span>
              <span className="truncate">{getLeadAdLabel(lead)}</span>
            </span>
            {getLeadAdSubLabel(lead) && (
              <span className="max-w-[180px] truncate text-neutral-400">{getLeadAdSubLabel(lead)}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-neutral-300">{EMPTY}</span>
        )}
      </td>
      <td className="data-table-td">
        <div className="flex flex-col items-start gap-1 text-xs">
          <span className="font-semibold text-neutral-700">{getNextAction(lead)}</span>
          <span className="text-neutral-400">
            {nextFollowUp ? formatDateTime(nextFollowUp.scheduledAt) : 'No follow-up scheduled'}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onScheduleFollowUp(lead);
            }}
            className="mt-1 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
          >
            <CalendarDaysIcon className="h-3.5 w-3.5" />
            {nextFollowUp ? 'Reschedule' : 'Schedule'}
          </button>
        </div>
      </td>
      <td className="data-table-td" onClick={(event) => event.stopPropagation()}>
        <select
          className="cursor-pointer appearance-none rounded-md border-0 bg-transparent px-2 py-1 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus:ring-0"
          value={lead.assignedAgentId || ''}
          onChange={(event) => onUpdateLead(lead.id, { assignedAgentId: event.target.value || null })}
        >
          <option value="">Unassigned</option>
          {agentOptions.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </td>
      <td className="data-table-td" onClick={(event) => event.stopPropagation()}>
        <select
          className="cursor-pointer appearance-none rounded-full border-0 px-3 py-1 text-[10px] font-bold focus:ring-0"
          style={getStagePillStyle(getLeadStageColor(lead))}
          value={lead.pipelineStageId || ''}
          onChange={(event) => onStatusChange?.(lead, event.target.value || null)}
        >
          <option value="">— No status —</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

function LeadDrawer({ leadId, onClose, agents }) {
  const currentAgent = useAuthStore((state) => state.agent);
  const agency = useAuthStore((state) => state.agency);
  const { data, isLoading } = useLead(leadId);
  const callLogsQuery = useCallLogs({ leadId, limit: 20 });
  const lead = data?.data;
  const callLogs = callLogsQuery.data?.data || [];
  const selectedCatalogItems = lead?.selectedCatalogItems || [];
  const customTripDetails = lead?.customTripDetails && Object.keys(lead.customTripDetails).length
    ? lead.customTripDetails
    : null;
  const readinessDetails = customTripDetails?.travelReadiness || null;
  const stayrouteOnamDetails = customTripDetails?.stayrouteOnam || null;
  const flowAnswerSections = getFlowAnswerSections(customTripDetails || {});
  const hasReadinessDetails = Boolean(
    readinessDetails?.travellerCount
    || readinessDetails?.bookingReadiness
    || readinessDetails?.departureAirport
  );
  const hasStayrouteOnamDetails = Boolean(
    stayrouteOnamDetails?.travellerCount
    || stayrouteOnamDetails?.departureAirport
    || stayrouteOnamDetails?.roomType
  );
  const isCustomTripLead = String(lead?.itemType || '').toUpperCase() === 'CUSTOM_TRIP'
    || String(lead?.interest || '').toUpperCase().includes('CUSTOM_TRIP')
    || String(lead?.notes || '').toLowerCase().includes('custom trip');
  const shouldShowCustomTripDetails = Boolean(
    customTripDetails && (hasCustomTripDetails(customTripDetails) || isCustomTripLead)
  );
  const hasDetailedCustomTripPreferences = Boolean(customTripDetails && hasCustomTripDetails(customTripDetails));
  const requestSummaries = getLeadRequestSummaries(lead, customTripDetails || {});
  const hasWhatsAppFlowAnswers = Boolean(
    flowAnswerSections.length
    || customTripDetails?.flowSubmissions
    || customTripDetails?.flowAnswers
    || customTripDetails?.serviceEnquiry
    || customTripDetails?.propertyEnquiry
    || customTripDetails?.packageEnquiry
  );
  const requestSourceLabel = hasWhatsAppFlowAnswers ? 'WhatsApp Flow' : formatSource(lead?.source);
  const enquiryDetailsTitle = isCustomTripLead ? 'Custom Trip Details' : 'Captured Enquiry Details';
  const enquiryDetailsSubtitle = hasWhatsAppFlowAnswers ? 'Answers captured from WhatsApp flow' : `Preferences submitted from ${requestSourceLabel}`;
  const hasMetaAttribution = Boolean(
    lead?.metaLeadgenId
    || lead?.metaCampaignId
    || lead?.metaFormId
    || lead?.metaAdId
  );

  const [activeTab, setActiveTab] = useState('Notes');
  const [noteContent, setNoteContent] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDrawerEditing, setIsDrawerEditing] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [editState, setEditState] = useState({});

  const updateLead = useUpdateLead();
  const sendStaffFirstOutreach = useSendStaffFirstOutreach();
  const drawerStagesQuery = usePipelineStages();
  const drawerStages = (drawerStagesQuery.data?.data || []).filter((stage) => stage.isActive);
  const addNote = useAddNote();

  function handleDrawerStageChange(stageId) {
    if (!lead) return;
    if (!stageId) {
      updateLead.mutate({ id: lead.id, data: { pipelineStageId: null } });
      return;
    }
    const stage = drawerStages.find((item) => item.id === stageId);
    if (stage?.kind === 'LOST' && !lead.lostReason) {
      const lostReason = window.prompt('Why was this lead lost?');
      if (!lostReason?.trim()) return;
      updateLead.mutate({ id: lead.id, data: { pipelineStageId: stageId, lostReason: lostReason.trim() } });
      return;
    }
    updateLead.mutate({ id: lead.id, data: { pipelineStageId: stageId } });
  }
  const addFollowup = useAddFollowUp();
  const updateFollowup = useUpdateFollowUp();

  const nextFollowUp = getNextFollowUp(lead);
  const attentionBadges = lead ? getAttentionBadges(lead) : [];
  const leadScore = getLeadScore(lead);
  const tabItems = [
    { key: 'Notes', label: `Notes ${lead?.notesList?.length || 0}` },
    { key: 'Follow-ups', label: `Follow-ups ${lead?.followUps?.length || 0}` },
    { key: 'Timeline', label: `Timeline ${lead?.timeline?.length || callLogs.length || ''}`.trim() },
  ];

  const handleEditClick = () => {
    setEditState({
      customerName: lead?.customer?.name || '',
      customerPhone: lead?.customer?.phone || '',
      customerEmail: lead?.customer?.email || '',
      source: lead?.source || '',
      budgetPerPerson: lead?.budgetPerPerson || 0,
      destination: lead?.destination || '',
      place: lead?.place || '',
      assignedAgentId: lead?.assignedAgentId || '',
      tagsText: (lead?.tags || []).join(', '),
    });
    setIsDrawerEditing(true);
  };

  const handleSave = () => {
    const tags = String(editState.tagsText || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const { tagsText, ...leadUpdates } = editState;

    updateLead.mutate(
      {
        id: leadId,
        data: {
          ...leadUpdates,
          assignedAgentId: editState.assignedAgentId || null,
          tags,
        },
      },
      {
        onSuccess: () => {
          setIsEditModalOpen(false);
          setIsDrawerEditing(false);
        },
      }
    );
  };

  const openWhatsApp = () => {
    const phone = lead?.customer?.phone?.replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer');
  };

  const openCall = () => {
    // Open the device's native dialer with the customer's number pre-filled.
    const sanitized = String(lead?.customer?.phone || '').trim().replace(/[^\d+]/g, '');
    if (!sanitized) return;
    window.location.href = `tel:${sanitized}`;
  };

  const handleSendStaffFirstOutreach = async () => {
    try {
      await sendStaffFirstOutreach.mutateAsync(leadId);
      toast.success('First staff WhatsApp outreach sent');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to send first staff WhatsApp outreach');
    }
  };

  if (!leadId) return null;

  const agentOptions = mergeAssignedAgentOption(agents, lead);
  const firstOutreach = lead?.customTripDetails?.firstOutreach || null;
  const canSendStaffFirstOutreach = Boolean(
    agency?.staffWhatsAppEnabled
    && lead?.assignedAgentId
    && currentAgent?.id === lead?.assignedAgentId
    && String(firstOutreach?.status || '').toUpperCase() !== 'SENT'
  );

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-neutral-200 bg-white shadow-2xl lg:max-w-[720px] xl:max-w-[840px]">
        <div className="border-b border-neutral-100 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            {isLoading ? (
              <div className="flex w-full animate-pulse gap-4">
                <div className="h-12 w-12 shrink-0 rounded-full bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 rounded bg-neutral-100" />
                  <div className="h-3 w-1/3 rounded bg-neutral-100" />
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-600 ring-2 ring-neutral-200">
                  {getInitials(lead?.customer?.name, 'L')}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold tracking-tight text-neutral-900">
                    {lead?.customer?.name || 'Unnamed Lead'}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <select
                      value={lead?.pipelineStageId || ''}
                      onChange={(event) => handleDrawerStageChange(event.target.value || null)}
                      style={getStagePillStyle(getLeadStageColor(lead))}
                      className="cursor-pointer appearance-none rounded-full border-0 px-2.5 py-0.5 text-[10px] font-bold focus:ring-0"
                      title="Change status"
                    >
                      <option value="">No status</option>
                      {drawerStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>{stage.name}</option>
                      ))}
                    </select>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getLeadScoreTone(leadScore)}`}>
                      Score {leadScore}
                    </span>
                    {attentionBadges.slice(0, 2).map((badge) => (
                      <span
                        key={badge.key}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {isDrawerEditing ? (
                <>
                  <button
                    onClick={() => setIsDrawerEditing(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateLead.isPending}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
                  >
                    {updateLead.isPending ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEditClick}
                  className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
              )}
              <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!isLoading && lead && (
            <div className="mt-4 grid grid-cols-5 gap-1.5 sm:mt-5 sm:gap-2">
              <QuickAction icon={ChatBubbleLeftRightIcon} label="WhatsApp" onClick={openWhatsApp} />
              <QuickAction
                icon={PhoneIcon}
                label="Call"
                onClick={openCall}
                disabled={!lead?.customer?.phone}
              />
              <QuickAction icon={CalendarDaysIcon} label="Follow-up" onClick={() => {
                setFollowupDate(getDefaultFollowupDateTime());
                setFollowupNote('');
                setIsFollowupModalOpen(true);
              }} />
              <QuickAction icon={UserPlusIcon} label="Assign" onClick={handleEditClick} />
              <QuickAction icon={PencilIcon} label="Note" onClick={() => {
                setNoteContent('');
                setIsNoteModalOpen(true);
              }} />
              {agency?.staffWhatsAppEnabled ? (
                <QuickAction
                  icon={ChatBubbleLeftRightIcon}
                  label={String(firstOutreach?.status || '').toUpperCase() === 'SENT' ? 'First Sent' : '1st Outreach'}
                  onClick={handleSendStaffFirstOutreach}
                  disabled={!canSendStaffFirstOutreach || sendStaffFirstOutreach.isPending}
                />
              ) : null}
            </div>
          )}

        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
        {!isLoading && lead && (
          <div className="border-b border-neutral-100 px-4 py-4 text-sm sm:px-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6">
              <LeadField
                label="Destination"
                value={lead.destination || EMPTY}
                isEditing={isDrawerEditing}
                editControl={
                  <input
                    type="text"
                    value={editState.destination}
                    onChange={(event) => setEditState({ ...editState, destination: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField
                label="Source"
                value={formatSource(lead.source)}
                isEditing={isDrawerEditing}
                editControl={
                  <select
                    value={editState.source}
                    onChange={(event) => setEditState({ ...editState, source: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  >
                    <option value="whatsapp_organic">WhatsApp Organic</option>
                    <option value="instagram">Instagram DM</option>
                    <option value="facebook_ad">Facebook Ad</option>
                    <option value="instagram_ad">Instagram Ad</option>
                    <option value="google_ad">Google Ad</option>
                    <option value="referral">Referral</option>
                    <option value="manual">Manual</option>
                  </select>
                }
              />
              <LeadField
                label="Contact Person"
                value={lead.customer?.name || EMPTY}
                isEditing={isDrawerEditing}
                editControl={
                  <input
                    type="text"
                    value={editState.customerName}
                    onChange={(event) => setEditState({ ...editState, customerName: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField
                label="Phone"
                value={formatPhone(lead.customer?.phone) || EMPTY}
                isEditing={isDrawerEditing}
                editControl={
                  <input
                    type="text"
                    value={editState.customerPhone}
                    onChange={(event) => setEditState({ ...editState, customerPhone: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField
                label="Email"
                value={lead.customer?.email || EMPTY}
                isEditing={isDrawerEditing}
                editControl={
                  <input
                    type="email"
                    value={editState.customerEmail}
                    onChange={(event) => setEditState({ ...editState, customerEmail: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField
                label="Budget / Person"
                value={lead.budgetPerPerson ? formatCurrency(lead.budgetPerPerson) : EMPTY}
                isEditing={isDrawerEditing}
                editControl={
                  <input
                    type="number"
                    value={editState.budgetPerPerson / 100}
                    onChange={(event) => setEditState({ ...editState, budgetPerPerson: Number(event.target.value) * 100 })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
              <LeadField label="Created" value={formatDate(lead.createdAt)} />
              <LeadField label="Lead Score" value={`${leadScore}/100`} />
              <LeadField label="Last Activity" value={getActivityLabel(lead)} />
              <LeadField label="Next Contact" value={nextFollowUp ? formatDateTime(nextFollowUp.scheduledAt) : EMPTY} />
              {agency?.staffWhatsAppEnabled ? (
                <LeadField
                  label="Staff First Outreach"
                  value={String(firstOutreach?.status || '').toUpperCase() === 'SENT'
                    ? `Sent ${firstOutreach?.sentAt ? formatDateTime(firstOutreach.sentAt) : ''}`.trim()
                    : firstOutreach?.status || 'Not sent'}
                />
              ) : null}
              <LeadField
                label="Assigned To"
                value={lead.assignedAgent?.name || 'Unassigned'}
                isEditing={isDrawerEditing}
                editControl={
                  <select
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                    value={editState.assignedAgentId || ''}
                    onChange={(event) => setEditState({ ...editState, assignedAgentId: event.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                }
              />
              <LeadField
                label="Place"
                value={lead.place || EMPTY}
                isEditing={isDrawerEditing}
                editControl={
                  <input
                    type="text"
                    value={editState.place || ''}
                    onChange={(event) => setEditState({ ...editState, place: event.target.value })}
                    className="w-full rounded-md border-neutral-200 bg-neutral-50 px-2 py-1 text-sm focus:ring-0"
                  />
                }
              />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-neutral-400">
                <TagIcon className="h-4 w-4" />
                Tags
              </div>
              {(lead.tags || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {lead.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">{EMPTY}</p>
              )}
            </div>

            {requestSummaries.length > 0 && (
              <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Requested Services</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {requestSummaries.length} request{requestSummaries.length === 1 ? '' : 's'} captured from {requestSourceLabel}
                  </p>
                </div>
                <div className="grid gap-2">
                  {requestSummaries.map((item) => (
                    <div key={item.key} className={`rounded-xl border px-3 py-2 ${item.tone}`}>
                      <p className="text-sm font-bold text-neutral-900">{item.title}</p>
                      <p className="mt-1 text-xs font-semibold text-neutral-600">{item.meta || EMPTY}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasMetaAttribution && (
              <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Meta Attribution</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {formatSource(lead.source)} campaign details
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <DetailValue label="Campaign" value={lead.metaCampaignName || lead.metaCampaignId || EMPTY} />
                  <DetailValue label="Ad Set" value={lead.metaAdSetName || lead.metaAdSetId || EMPTY} />
                  <DetailValue label="Ad" value={lead.metaAdName || lead.metaAdId || EMPTY} />
                  <DetailValue label="Lead Form" value={lead.metaFormId || EMPTY} />
                  <DetailValue label="Platform" value={lead.metaPlatform || EMPTY} />
                  <DetailValue label="Leadgen ID" value={lead.metaLeadgenId || EMPTY} />
                </div>
              </div>
            )}

            {selectedCatalogItems.length > 0 && (
              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Customer Selections</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900">
                      {selectedCatalogItems.length} catalog selection{selectedCatalogItems.length === 1 ? '' : 's'} in this conversation
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedCatalogItems.map((item) => (
                    <div key={`${item.itemType}-${item.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-white bg-white px-3 py-2 shadow-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${selectedItemTypeMeta(item.itemType)[1]}`}>
                            {selectedItemTypeMeta(item.itemType)[0]}
                          </span>
                          <p className="truncate text-sm font-semibold text-neutral-900">{item.name || EMPTY}</p>
                        </div>
                        {item.subtitle && (
                          <p className="mt-1 text-xs text-neutral-500">{item.subtitle}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-xs font-semibold text-neutral-600">
                        {item.price ? formatCurrency(item.price) : EMPTY}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasReadinessDetails && (
              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Questionnaire Details</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    Travel readiness answers from {requestSourceLabel}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <DetailValue label="Package" value={lead.package?.name || lead.campaignName || EMPTY} />
                  <DetailValue label="Travellers" value={formatReadinessAnswer(readinessDetails.travellerCount || lead.travellers)} />
                  <DetailValue label="Booking Readiness" value={formatReadinessAnswer(readinessDetails.bookingReadiness)} />
                  <DetailValue label="Departure Airport" value={formatReadinessAnswer(readinessDetails.departureAirport)} />
                  {customTripDetails?.routingIntentLabel && <DetailValue label="Routed To" value={customTripDetails.routingIntentLabel} />}
                  {lead.assignedAgent?.name && <DetailValue label="Specialist" value={lead.assignedAgent.name} />}
                </div>
              </div>
            )}

            {hasStayrouteOnamDetails && (
              <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">Onam Trip Questionnaire</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    Answers submitted from WhatsApp welcome chat
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <DetailValue label="Trip" value={lead.campaignName || 'Onam trip'} />
                  <DetailValue label="Travellers" value={formatReadinessAnswer(stayrouteOnamDetails.travellerCount || lead.travellers)} />
                  <DetailValue label="Departure Airport" value={formatReadinessAnswer(stayrouteOnamDetails.departureAirport)} />
                  <DetailValue label="Preferred Room Type" value={formatReadinessAnswer(stayrouteOnamDetails.roomType)} />
                  {lead.assignedAgent?.name && <DetailValue label="Specialist" value={lead.assignedAgent.name} />}
                </div>
              </div>
            )}

            {(lead?.adId || hasMetaAttribution) && (
              <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Ad</span>
                  <p className="text-sm font-semibold text-neutral-900">Came from a Meta ad</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <DetailValue label="Ad" value={getLeadAdLabel(lead) || EMPTY} />
                  {lead.metaCampaignName && <DetailValue label="Campaign" value={lead.metaCampaignName} />}
                  {lead.metaAdSetName && <DetailValue label="Ad Set" value={lead.metaAdSetName} />}
                  {lead.metaPlatform && <DetailValue label="Platform" value={formatSource(`${lead.metaPlatform}_ad`)} />}
                  {lead.adId && <DetailValue label="Ad ID" value={lead.adId} />}
                </div>
                {lead.adSourceUrl && (
                  <a
                    href={lead.adSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                  >
                    View the ad on Meta ↗
                  </a>
                )}
              </div>
            )}

            {shouldShowCustomTripDetails && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">{enquiryDetailsTitle}</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">{enquiryDetailsSubtitle}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {(customTripDetails.serviceCategory || customTripDetails.service) && (
                    <>
                      <DetailValue label="Service Category" value={formatServiceLabel(customTripDetails.serviceCategory)} />
                      <DetailValue label="Selected Service" value={formatServiceLabel(customTripDetails.service)} />
                    </>
                  )}
                  {customTripDetails.propertyName && <DetailValue label="Property" value={customTripDetails.propertyName} />}
                  <DetailValue label="Destination" value={customTripDetails.propertyLocation || customTripDetails.destination || lead.destination || EMPTY} />
                  {(customTripDetails.propertyType || customTripDetails.stayType) && (
                    <DetailValue label="Stay Type" value={customTripDetails.propertyType || customTripDetails.stayType} />
                  )}
                  {customTripDetails.checkInDate && <DetailValue label="Check-in" value={customTripDetails.checkInDate} />}
                  {customTripDetails.checkOutDate && <DetailValue label="Checkout" value={customTripDetails.checkOutDate} />}
                  {customTripDetails.groupType && <DetailValue label="Group Type" value={customTripDetails.groupType} />}
                  {customTripDetails.rooms && <DetailValue label="Rooms" value={customTripDetails.rooms} />}
                  <DetailValue label="Travel Date" value={customTripDetails.travelDate || lead.travelDates || EMPTY} />
                  <DetailValue
                    label="Travellers"
                    value={
                      customTripDetails.travellersText
                      || customTripDetails.travellers
                      || (readinessDetails?.travellerCount ? formatReadinessAnswer(readinessDetails.travellerCount) : '')
                      || lead.travellers
                      || EMPTY
                    }
                  />
                  {customTripDetails.adults !== undefined && customTripDetails.adults !== null && <DetailValue label="Adults" value={customTripDetails.adults} />}
                  {customTripDetails.children6To12 !== undefined && customTripDetails.children6To12 !== null && <DetailValue label="Children 6-12" value={customTripDetails.children6To12} />}
                  {customTripDetails.childrenBelow5 !== undefined && customTripDetails.childrenBelow5 !== null && <DetailValue label="Children Below 5" value={customTripDetails.childrenBelow5} />}
                  <DetailValue
                    label="Budget / Person"
                    value={customTripDetails.budgetText || (customTripDetails.budgetPerPerson ? formatCurrency(customTripDetails.budgetPerPerson) : lead.budgetPerPerson ? formatCurrency(lead.budgetPerPerson) : EMPTY)}
                  />
                  {customTripDetails.campaignName && <DetailValue label="Campaign" value={customTripDetails.campaignName} />}
                  {customTripDetails.submittedAt && <DetailValue label="Submitted" value={formatDateTime(customTripDetails.submittedAt)} />}
                </div>
                {!hasDetailedCustomTripPreferences && (
                  <div className="mt-3 rounded-xl border border-amber-100 bg-white/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Captured Status</p>
                    <p className="mt-1 text-sm font-medium text-neutral-800">
                      Custom trip flow was submitted, but destination, date, budget, and notes were not received in the WhatsApp flow payload.
                    </p>
                  </div>
                )}
                {customTripDetails.serviceDetails && (
                  <div className="mt-3 rounded-xl border border-sky-100 bg-white/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Ticketing Details</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-neutral-800">{customTripDetails.serviceDetails}</p>
                  </div>
                )}
                {flowAnswerSections.map((section) => (
                  <div key={section.key} className="mt-3 rounded-xl border border-amber-100 bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">{section.title}</p>
                    {section.subtitle && <p className="mt-1 text-sm font-bold text-neutral-900">{section.subtitle}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      {section.entries.map(([label, value]) => (
                        <DetailValue key={`${section.key}-${label}`} label={label} value={value} />
                      ))}
                    </div>
                  </div>
                ))}
                {customTripDetails.notes && (
                  <div className="mt-3 rounded-xl border border-amber-100 bg-white/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Trip Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-neutral-800">{customTripDetails.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex shrink-0 gap-5 overflow-x-auto border-b border-neutral-100 px-4 hide-scrollbar sm:gap-6 sm:px-6">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-neutral-50/50 px-4 py-5 sm:px-6 sm:py-6">
          {!isLoading && lead && (
            <>
              {activeTab === 'Notes' && (
                <NotesPanel
                  lead={lead}
                  onAddClick={() => {
                    setNoteContent('');
                    setIsNoteModalOpen(true);
                  }}
                />
              )}

              {activeTab === 'Follow-ups' && (
                <FollowUpsPanel
                  addNote={addNote}
                  lead={lead}
                  updateFollowup={updateFollowup}
                  onAddClick={() => {
                    setFollowupDate(getDefaultFollowupDateTime());
                    setFollowupNote('');
                    setIsFollowupModalOpen(true);
                  }}
                />
              )}

              {activeTab === 'Timeline' && (
                <TimelinePanel callLogs={callLogs} lead={lead} />
              )}
            </>
          )}
        </div>
        </div>
      </aside>

      {isEditModalOpen && lead && (
        <EditLeadModal
          agentOptions={agentOptions}
          editState={editState}
          isSaving={updateLead.isPending}
          onChange={setEditState}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {isNoteModalOpen && lead && (
        <AddNoteModal
          addNote={addNote}
          lead={lead}
          noteContent={noteContent}
          setNoteContent={setNoteContent}
          onClose={() => setIsNoteModalOpen(false)}
        />
      )}

      {isFollowupModalOpen && lead && (
        <FollowupScheduleModal
          followupDate={followupDate}
          followupNote={followupNote}
          isSaving={addFollowup.isPending}
          lead={lead}
          onClose={() => setIsFollowupModalOpen(false)}
          onDateChange={setFollowupDate}
          onNoteChange={setFollowupNote}
          onSubmit={(event) => {
            event.preventDefault();
            if (!followupNote.trim()) return;
            addFollowup.mutate({
              id: lead.id,
              data: { scheduledAt: followupDate, note: followupNote.trim(), agentId: lead.assignedAgent?.id },
            }, {
              onSuccess: () => setIsFollowupModalOpen(false)
            });
          }}
        />
      )}
    </div>
  );
}

function QuickAction({ disabled = false, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-neutral-200 bg-neutral-50 px-1 py-2 text-center text-[11px] font-bold leading-tight text-neutral-600 transition-all hover:border-neutral-300 hover:bg-white hover:text-neutral-900 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-200 disabled:hover:bg-neutral-50 disabled:hover:text-neutral-600 sm:min-h-[64px] sm:text-xs"
      type="button"
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="w-full">{label}</span>
    </button>
  );
}

function EditLeadModal({ agentOptions, editState, isSaving, onChange, onClose, onSave }) {
  const updateField = (field, value) => onChange({ ...editState, [field]: value });
  const sourceOptions = SOURCE_OPTIONS.filter((option) => option.value !== 'all');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Edit Lead</h3>
            <p className="mt-1 text-sm text-neutral-500">Update lead details and assignment.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
          <ModalField label="Contact Person">
            <input
              value={editState.customerName || ''}
              onChange={(event) => updateField('customerName', event.target.value)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
            />
          </ModalField>
          <ModalField label="Phone">
            <input
              value={editState.customerPhone || ''}
              onChange={(event) => updateField('customerPhone', event.target.value)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
            />
          </ModalField>
          <ModalField label="Email">
            <input
              type="email"
              value={editState.customerEmail || ''}
              onChange={(event) => updateField('customerEmail', event.target.value)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
            />
          </ModalField>
          <ModalField label="Source">
            <select
              value={editState.source || ''}
              onChange={(event) => updateField('source', event.target.value)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
            >
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Destination">
            <input
              value={editState.destination || ''}
              onChange={(event) => updateField('destination', event.target.value)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
            />
          </ModalField>
          <ModalField label="Place">
            <input
              value={editState.place || ''}
              onChange={(event) => updateField('place', event.target.value)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
              placeholder="e.g. Kochi, Kerala"
            />
          </ModalField>
          <ModalField label="Budget / Person">
            <input
              type="number"
              min="0"
              value={Number(editState.budgetPerPerson || 0) / 100}
              onChange={(event) => updateField('budgetPerPerson', Number(event.target.value || 0) * 100)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
            />
          </ModalField>
          <ModalField label="Assigned To">
            <select
              value={editState.assignedAgentId || ''}
              onChange={(event) => updateField('assignedAgentId', event.target.value)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
            >
              <option value="">Unassigned</option>
              {agentOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Tags" className="sm:col-span-2">
            <input
              value={editState.tagsText || ''}
              onChange={(event) => updateField('tagsText', event.target.value)}
              className="shell-input-rect h-11 bg-neutral-50 text-sm"
              placeholder="urgent, honeymoon, high budget"
            />
          </ModalField>
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-100 bg-neutral-50/70 px-5 py-4">
          <button type="button" onClick={onClose} className="shell-button-secondary h-10 px-4 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="shell-button-primary h-10 px-5 text-sm disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save Lead'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalField({ children, className = '', label }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function LeadField({ editControl, isEditing = false, label, value }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-neutral-400">{label}</div>
      {isEditing && editControl ? (
        editControl
      ) : (
        <div className="break-words font-medium text-neutral-900">{value}</div>
      )}
    </div>
  );
}

function DetailValue({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-amber-700/70">{label}</div>
      <div className="break-words font-semibold text-neutral-900">{value || EMPTY}</div>
    </div>
  );
}

function NotesPanel({ lead, onAddClick }) {
  const manualNotes = (lead.notesList || []).filter((note) => {
    return !(
      note.content.startsWith('Lead status updated:') || 
      note.content.startsWith('Assignment updated:') || 
      note.content.startsWith('Lead details updated:') ||
      note.content.startsWith('Follow-up Outcome:') ||
      note.content.startsWith('Follow-up assigned') ||
      note.content.startsWith('Follow-up completed') ||
      note.content.startsWith('Follow-up cancelled')
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-neutral-900">Notes</h3>
        <button onClick={onAddClick} className="shell-button-primary h-8 px-3 text-xs">
          <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Note
        </button>
      </div>

      {manualNotes.length === 0 ? (
        <EmptyPanel text="No manual notes yet. Add your first note above." />
      ) : (
        <div className="mt-4 space-y-3">
          {manualNotes.map((note) => (
            <div key={note.id} className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 text-sm shadow-sm">
              <div className="whitespace-pre-wrap text-neutral-600">{note.content}</div>
              <div className="mt-3 flex justify-between text-xs font-medium text-neutral-400">
                <span>{note.agent?.name || 'Staff'}</span>
                <span>{formatDateTime(note.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FollowUpsPanel({
  addNote,
  lead,
  updateFollowup,
  onAddClick
}) {
  const [resolvingId, setResolvingId] = useState(null);
  const [resolvingStatus, setResolvingStatus] = useState(null);
  const [outcomeNote, setOutcomeNote] = useState('');

  const handleResolve = (followUpId) => {
    const trimmed = outcomeNote.trim();
    if (!trimmed) return;
    updateFollowup.mutate({ id: lead.id, followUpId, data: { status: resolvingStatus, outcome: trimmed } });
    addNote.mutate({ id: lead.id, data: { content: `Follow-up Outcome: ${trimmed}` } });
    setResolvingId(null);
    setOutcomeNote('');
    setResolvingStatus(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-neutral-900">Follow-Ups</h3>
        <button onClick={onAddClick} className="shell-button-primary h-8 px-3 text-xs">
          <PlusIcon className="h-3.5 w-3.5 mr-1" /> Schedule
        </button>
      </div>

      {(!lead.followUps || lead.followUps.length === 0) ? (
        <EmptyPanel text="No follow-ups scheduled" />
      ) : (
        <div className="mt-4 space-y-3">
          {lead.followUps.map((followUp) => {
            const isDone = followUp.status === 'Done';
            const isOverdue = followUp.status === 'Scheduled' && new Date(followUp.scheduledAt).getTime() < Date.now();

            return (
              <div
                key={followUp.id}
                className={`relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius-md)] border bg-white p-4 shadow-sm ${
                  isDone ? 'border-neutral-100 opacity-60' : isOverdue ? 'border-rose-200' : 'border-neutral-200'
                }`}
              >
                {followUp.status === 'Scheduled' && (
                  <div className={`absolute left-0 top-0 h-full w-1 ${isOverdue ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className={`mt-0.5 text-xs font-bold uppercase tracking-wider ${isOverdue ? 'text-rose-600' : 'text-neutral-400'}`}>
                    {isOverdue ? 'Overdue' : followUp.status}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-sm font-semibold text-neutral-700">{formatDateTime(followUp.scheduledAt)}</div>
                    {(isDone || followUp.status === 'Cancelled') && (
                      <div className="mt-0.5 text-[10px] font-medium text-neutral-400">
                        {followUp.status === 'Done' ? 'Completed: ' : 'Cancelled: '}{formatDateTime(followUp.updatedAt)}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-neutral-600">{followUp.note}</p>
                
                {resolvingId === followUp.id ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-xs font-bold text-neutral-600">
                      {resolvingStatus === 'Done' ? 'Complete Follow-up' : 'Cancel Follow-up'}
                    </div>
                    <textarea
                      placeholder="Add an outcome note (required)..."
                      className="w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      rows="2"
                      value={outcomeNote}
                      onChange={(e) => setOutcomeNote(e.target.value)}
                    />
                    <div className="mt-1 flex justify-end gap-2">
                      <button
                        className="min-h-10 rounded-md px-4 py-2 text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-200 active:scale-[0.98]"
                        onClick={() => setResolvingId(null)}
                      >
                        Back
                      </button>
                      <button
                        disabled={!outcomeNote.trim()}
                        className={`min-h-10 rounded-md px-4 py-2 text-xs font-semibold text-white transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                          resolvingStatus === 'Done' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                        }`}
                        onClick={() => handleResolve(followUp.id)}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  followUp.status === 'Scheduled' && (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                      <button
                        className="flex min-h-10 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 active:scale-[0.98]"
                        onClick={() => {
                          setResolvingId(followUp.id);
                          setResolvingStatus('Cancelled');
                          setOutcomeNote('');
                        }}
                      >
                        <XMarkIcon className="h-4 w-4" />
                        Cancel
                      </button>
                      <button
                        className="flex min-h-10 items-center justify-center gap-1 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-200 active:scale-[0.98]"
                        onClick={() => {
                          setResolvingId(followUp.id);
                          setResolvingStatus('Done');
                          setOutcomeNote('');
                        }}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        Mark Done
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



function formatCallStatusLabel(status = '') {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Call';
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '';
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (!mins) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function RecordingPlayer({ callLogId }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const blob = await callsApi.recording(callLogId);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError('Recording could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  if (audioUrl) {
    return <audio controls src={audioUrl} className="mt-2 w-full max-w-xs" />;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
      >
        <PhoneIcon className="h-3 w-3" />
        {loading ? 'Loading…' : 'Play recording'}
      </button>
      {error ? <span className="ml-2 text-xs text-red-500">{error}</span> : null}
    </div>
  );
}

function TimelinePanel({ callLogs = [], lead }) {
  const serverTimeline = Array.isArray(lead.timeline) ? lead.timeline : [];
  const fallbackTimeline = [
    {
      id: `lead-created-${lead.id}`,
      type: 'lead_created',
      title: 'Lead Created',
      description: `Lead ${lead.customer?.name || 'Unnamed Lead'} created via ${formatSource(lead.source)}`,
      time: lead.createdAt,
    },
    ...(lead.messages || []).map((message) => ({
      id: message.id,
      type: 'message',
      title: message.direction === 'IN' ? 'Message Received' : 'Message Sent',
      description: message.content,
      time: message.timestamp,
      status: message.status,
      actor: message.direction === 'IN' ? lead.customer?.name : message.agent?.name,
    })),
    ...callLogs.map((callLog) => {
      const duration = formatDuration(callLog.durationSeconds);
      return {
        id: callLog.id,
        type: 'call',
        title: `Call ${formatCallStatusLabel(callLog.status)}`,
        description: [
          `${callLog.agent?.name || 'Staff'} called ${callLog.customer?.name || lead.customer?.name || 'customer'}`,
          duration ? `Duration ${duration}` : '',
        ].filter(Boolean).join(' - '),
        actor: callLog.agent?.name,
        time: callLog.startedAt || callLog.createdAt,
        source: { id: callLog.id, recordingUrl: callLog.recordingUrl },
      };
    }),
  ];
  const timeline = serverTimeline.length ? serverTimeline : fallbackTimeline;

  return (
    <ActivityTimeline
      events={timeline}
      emptyText="No lead timeline activity yet."
      renderFooter={(event) => {
        const recordingId = event.type === 'call' && event.source?.recordingUrl ? event.source.id : null;
        return recordingId ? <RecordingPlayer callLogId={recordingId} /> : null;
      }}
    />
  );
}


function EmptyPanel({ text }) {
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-neutral-200 bg-white py-10 text-center">
      <div className="text-sm text-neutral-400">{text}</div>
    </div>
  );
}

function BulkActionBar({ agents, count, isDeleting, isPending, onAssign, onClear, onDelete }) {
  const [bulkAgentId, setBulkAgentId] = useState('');
  const isBusy = isPending || isDeleting;

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-4 md:pb-6 pointer-events-none animate-fade-in">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 md:gap-4 rounded-2xl border border-neutral-200/80 bg-white/95 px-3 py-2.5 md:px-6 md:py-3.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 w-full max-w-lg md:w-auto md:max-w-none">
        {/* Selection count badge */}
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-neutral-900 text-[11px] md:text-xs font-bold text-white shadow-sm">
            {count}
          </span>
          <span className="text-xs md:text-sm font-semibold text-neutral-700 hidden md:inline">
            {count === 1 ? 'lead' : 'leads'} selected
          </span>
        </div>

        {/* Divider (desktop only) */}
        <div className="hidden md:block h-8 w-px bg-neutral-200" />

        {/* Staff picker */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <select
            value={bulkAgentId}
            onChange={(e) => setBulkAgentId(e.target.value)}
            disabled={isBusy}
            className="h-9 flex-1 min-w-0 md:w-48 md:flex-none cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 px-2 md:px-3 text-xs md:text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 focus:border-neutral-500 focus:ring-0"
          >
            <option value="">Select Staff</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        {/* Assign button */}
        <button
          onClick={() => {
            if (!bulkAgentId) return;
            onAssign(bulkAgentId);
            setBulkAgentId('');
          }}
          disabled={!bulkAgentId || isBusy}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 md:px-5 text-xs md:text-sm font-bold text-white shadow-sm transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <>
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden md:inline">Assigning...</span>
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Assign
            </>
          )}
        </button>

        {/* Unassign button (desktop only) */}
        <button
          onClick={() => {
            onAssign(null);
            setBulkAgentId('');
          }}
          disabled={isBusy}
          className="hidden md:flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-600 transition-all hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-40"
        >
          Unassign
        </button>

        <button
          onClick={onDelete}
          disabled={isBusy}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 md:px-4 md:text-sm"
        >
          {isDeleting ? (
            <>
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden md:inline">Deleting...</span>
            </>
          ) : (
            <>
              <TrashIcon className="h-3.5 w-3.5" />
              Delete
            </>
          )}
        </button>

        {/* Clear selection */}
        <button
          onClick={onClear}
          disabled={isBusy}
          className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          title="Clear selection"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
