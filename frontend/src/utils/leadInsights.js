import { formatCurrency, formatDateTime, timeAgo } from './formatters';

const CLOSED_STATUSES = new Set(['CONVERTED', 'LOST', 'CANCELLED']);

export const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook_ad', label: 'Facebook Ads' },
  { value: 'instagram_ad', label: 'Instagram Ads' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google', label: 'Google' },
  { value: 'referral', label: 'Referral' },
  { value: 'manual', label: 'Manual' },
  { value: 'direct', label: 'Direct' },
];

export const SORT_OPTIONS = [
  { value: 'hot', label: 'Hot Leads' },
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'overdue', label: 'Overdue First' },
  { value: 'nextFollowUp', label: 'Next Follow-up' },
  { value: 'highestBudget', label: 'Highest Budget' },
];

export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

export function formatStatus(status) {
  return String(status || 'UNKNOWN').replace(/_/g, ' ');
}

export function formatSource(source) {
  if (!source) return 'Direct';
  const normalized = String(source).toLowerCase();
  if (normalized === 'facebook_ad') return 'Facebook Ads';
  if (normalized === 'instagram_ad') return 'Instagram Ads';
  if (normalized === 'instagram' || normalized === 'instagram_dm') return 'Instagram DM';
  if (normalized === 'whatsapp' || normalized === 'whatsapp_organic') return 'WhatsApp';
  return String(source)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getScheduledFollowUps(lead) {
  return (lead?.followUps || [])
    .filter((followUp) => String(followUp.status || '').toLowerCase() === 'scheduled')
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
}

export function getNextFollowUp(lead) {
  return getScheduledFollowUps(lead)[0] || null;
}

export function getLastActivityDate(lead) {
  const messageDates = (lead?.messages || [])
    .map((message) => message.timestamp || message.createdAt)
    .filter(Boolean);
  const dates = [lead?.updatedAt, lead?.createdAt, ...messageDates].filter(Boolean);
  if (dates.length === 0) return null;
  return dates
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a)[0];
}

export function getLatestCustomerMessage(lead) {
  return (lead?.messages || [])
    .filter((message) => message.direction === 'IN')
    .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))[0];
}

export function isToday(dateValue) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function isPast(dateValue) {
  if (!dateValue) return false;
  return new Date(dateValue).getTime() < Date.now();
}

export function getAttentionBadges(lead) {
  const badges = [];
  const nextFollowUp = getNextFollowUp(lead);
  const latestInbound = getLatestCustomerMessage(lead);
  const isClosed = CLOSED_STATUSES.has(lead?.status);
  const score = getLeadScore(lead);

  if (nextFollowUp && isPast(nextFollowUp.scheduledAt) && !isToday(nextFollowUp.scheduledAt)) {
    badges.push({ key: 'overdue', label: 'Overdue', className: 'bg-rose-50 text-rose-700 border-rose-100' });
  } else if (nextFollowUp && isToday(nextFollowUp.scheduledAt)) {
    badges.push({ key: 'today', label: 'Today', className: 'bg-amber-50 text-amber-700 border-amber-100' });
  }

  if (!lead?.assignedAgentId && !isClosed) {
    badges.push({ key: 'unassigned', label: 'Unassigned', className: 'bg-sky-50 text-sky-700 border-sky-100' });
  }

  if (!nextFollowUp && !isClosed) {
    badges.push({ key: 'no-follow-up', label: 'No Follow-up', className: 'bg-orange-50 text-orange-700 border-orange-100' });
  }

  if (score >= 75 && !isClosed) {
    badges.push({ key: 'hot', label: 'Hot', className: 'bg-red-50 text-red-700 border-red-100' });
  }

  if (latestInbound) {
    const ageMs = Date.now() - new Date(latestInbound.timestamp || latestInbound.createdAt).getTime();
    if (ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000) {
      badges.push({ key: 'new-reply', label: 'New Reply', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' });
    }
  }

  return badges;
}

export function needsAttention(lead) {
  return getAttentionBadges(lead).length > 0;
}

export function getNextAction(lead) {
  const nextFollowUp = getNextFollowUp(lead);
  const latestInbound = getLatestCustomerMessage(lead);
  const hasSelectedItems = (lead?.selectedCatalogItems || []).length > 0 || lead?.packageId || lead?.propertyId;

  if (latestInbound) {
    const ageMs = Date.now() - new Date(latestInbound.timestamp || latestInbound.createdAt).getTime();
    if (ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000) return 'Reply to customer';
  }

  if (nextFollowUp && isPast(nextFollowUp.scheduledAt)) return 'Follow up now';
  if (nextFollowUp && isToday(nextFollowUp.scheduledAt)) return `Follow up ${formatDateTime(nextFollowUp.scheduledAt)}`;
  if (!lead?.assignedAgentId && !CLOSED_STATUSES.has(lead?.status)) return 'Assign owner';
  if (hasSelectedItems && ['PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'ENQUIRY'].includes(lead?.status)) return 'Send quote';
  if (!nextFollowUp && !CLOSED_STATUSES.has(lead?.status)) return 'Schedule follow-up';
  if (lead?.status === 'PACKAGE_INTERESTED') return 'Send quote';
  if (lead?.status === 'CONVERTED') return 'Review booking';
  if (lead?.status === 'LOST') return 'Review lost reason';
  return 'Review lead';
}

export function matchesSource(lead, sourceFilter) {
  if (!sourceFilter || sourceFilter === 'all') return true;
  const source = String(lead?.source || '').toLowerCase();
  if (sourceFilter === 'facebook_ad' || sourceFilter === 'instagram_ad') return source === sourceFilter;
  if (sourceFilter === 'direct') return !source || source.includes('direct') || source.includes('organic');
  return source.includes(sourceFilter);
}

export function matchesAgent(lead, agentFilter, currentAgentId) {
  if (!agentFilter || agentFilter === 'all') return true;
  if (agentFilter === 'mine') return currentAgentId ? lead?.assignedAgentId === currentAgentId : true;
  if (agentFilter === 'unassigned') return !lead?.assignedAgentId;
  return lead?.assignedAgentId === agentFilter;
}

export function matchesTag(lead, tagFilter) {
  if (!tagFilter || tagFilter === 'all') return true;
  return (lead?.tags || []).some((tag) => String(tag).toLowerCase() === String(tagFilter).toLowerCase());
}

export function matchesDateRange(lead, dateRange) {
  if (!dateRange || dateRange === 'all' || dateRange === 'custom') return true;
  const created = new Date(lead?.createdAt || 0);
  if (Number.isNaN(created.getTime())) return false;
  const now = new Date();

  if (dateRange === 'month') {
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }

  if (dateRange === 'year') {
    return created.getFullYear() === now.getFullYear();
  }

  return true;
}

export function sortLeads(leads, sortBy) {
  const sorted = [...leads];
  const dateValue = (value) => new Date(value || 0).getTime() || 0;

  if (sortBy === 'oldest') {
    return sorted.sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt));
  }

  if (sortBy === 'hot') {
    return sorted.sort((a, b) => getLeadScore(b) - getLeadScore(a) || dateValue(b.createdAt) - dateValue(a.createdAt));
  }

  if (sortBy === 'overdue') {
    return sorted.sort((a, b) => {
      const aNext = getNextFollowUp(a);
      const bNext = getNextFollowUp(b);
      const aOverdue = aNext && isPast(aNext.scheduledAt) ? 0 : 1;
      const bOverdue = bNext && isPast(bNext.scheduledAt) ? 0 : 1;
      return aOverdue - bOverdue || dateValue(aNext?.scheduledAt) - dateValue(bNext?.scheduledAt);
    });
  }

  if (sortBy === 'nextFollowUp') {
    return sorted.sort((a, b) => {
      const aNext = getNextFollowUp(a);
      const bNext = getNextFollowUp(b);
      if (!aNext && !bNext) return dateValue(b.createdAt) - dateValue(a.createdAt);
      if (!aNext) return 1;
      if (!bNext) return -1;
      return dateValue(aNext.scheduledAt) - dateValue(bNext.scheduledAt);
    });
  }

  if (sortBy === 'highestBudget') {
    return sorted.sort((a, b) => Number(b.budgetPerPerson || 0) - Number(a.budgetPerPerson || 0));
  }

  return sorted.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
}

export function getLeadScore(lead) {
  if (Number.isFinite(Number(lead?.leadScore))) return Number(lead.leadScore);
  let score = 10;
  if (lead?.assignedAgentId) score += 8;
  if (lead?.destination) score += 8;
  if (lead?.packageId || lead?.propertyId || (lead?.selectedCatalogItems || []).length) score += 15;
  if (lead?.budgetPerPerson) score += Math.min(18, Math.round(Number(lead.budgetPerPerson) / 500000));
  if (lead?.travellers > 1) score += Math.min(10, Number(lead.travellers) * 2);
  if (lead?.travelStart || lead?.travelDates) score += 6;
  if ((lead?.tags || []).some((tag) => /urgent|hot|vip|high/i.test(tag))) score += 12;
  if (['PACKAGE_INTERESTED', 'ENQUIRY', 'QUOTED'].includes(lead?.status)) score += 18;
  if (['CONTACTED', 'NEGOTIATING'].includes(lead?.status)) score += 10;
  if (lead?.status === 'CONVERTED' || lead?.status === 'BOOKED') return 100;
  if (lead?.status === 'LOST' || lead?.status === 'CANCELLED') return Math.min(score, 15);
  return Math.max(0, Math.min(100, score));
}

export function getLeadScoreTone(score) {
  if (score >= 75) return 'bg-red-50 text-red-700 border-red-100';
  if (score >= 50) return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-neutral-50 text-neutral-600 border-neutral-200';
}

export function getLeadValueLabel(lead) {
  if (!lead?.budgetPerPerson) return 'Budget not set';
  const travellers = Number(lead.travellers || 1);
  return `${formatCurrency(lead.budgetPerPerson)} / person${travellers > 1 ? ` x ${travellers}` : ''}`;
}

export function getActivityLabel(lead) {
  const lastActivity = getLastActivityDate(lead);
  return lastActivity ? timeAgo(lastActivity) : 'No activity';
}

export function getPipelineValue(leads) {
  return leads.reduce((total, lead) => {
    const travellers = Number(lead.travellers || 1);
    return total + Number(lead.budgetPerPerson || 0) * travellers;
  }, 0);
}
