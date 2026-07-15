// Resolves a mapped Instagram reel to the catalog item it advertises, and decides what a
// comment on it should do. Two entry points feed this: an inbound WhatsApp message carrying a
// handoff code (organic path) and a comment event carrying a media id (DM path). Both converge
// on a CatalogMediaLink row.
//
// The branching lives in pure functions below so it is unit-tested without a DB; the lookups
// are deliberately thin.

const { CatalogMediaLink, Property, Package, Service, Visa, Cruise, Lead } = require('../models');

// Leads that are still "open" — a reel handoff should attribute the live enquiry, not a
// closed/won one. Mirrors the set the WhatsApp inbound path uses.
const ACTIVE_LEAD_STATUSES = [
  'JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED',
  'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING',
];

const VALID_ACTIONS = new Set(['LEAD_FORM', 'WHATSAPP', 'DM_PDF']);
const DEFAULT_ACTION = 'WHATSAPP';

const ITEM_MODELS: Record<string, any> = {
  PROPERTY: Property,
  PACKAGE: Package,
  SERVICE: Service,
  VISA: Visa,
  CRUISE: Cruise,
};

// ── Pure decision logic ──────────────────────────────────────────────────────

// A per-reel override wins over the agency default; the default itself falls back to WHATSAPP
// so this never returns undefined even for an agency created before the column existed.
function resolveEffectiveAction(agency: any, link: any): string {
  const override = link?.actionOverride;
  if (override && VALID_ACTIONS.has(override)) return override;
  const agencyDefault = agency?.instagramReelDefaultAction;
  return VALID_ACTIONS.has(agencyDefault) ? agencyDefault : DEFAULT_ACTION;
}

// The token shape the existing lead-form pipeline validates (publicController.verifiedItemToken
// → leadFormConfig.parseItemToken): `<CATALOG_TYPE>:<uuid>`. We reuse it rather than build a
// parallel path.
function buildItemToken(link: any): string {
  if (!link || !link.itemType || !link.itemId) return '';
  return `${link.itemType}:${link.itemId}`;
}

// The shape the flow session reader (getSelectedFlowCatalogItem) expects, so a resolved reel
// pre-selects its item and the agency's existing SEND_ITEM_DOCUMENT node just works.
function buildSelectedItem(link: any, item: any = null): any {
  if (!link || !link.itemType || !link.itemId) return null;
  return {
    itemType: link.itemType,
    itemId: link.itemId,
    itemName: item?.name || item?.title || item?.country || undefined,
  };
}

const reelRefCode = require('../utils/reelRefCode');

function publicBaseUrl(explicit?: string): string {
  const base = explicit || process.env.PUBLIC_BASE_URL || process.env.BASE_URL || '';
  return String(base).replace(/\/+$/, '');
}

// The lead-form URL a reel comment sends. Mirrors bot buildFlowLeadFormUrl exactly (source +
// item token) so it lands on the SAME verified pipeline, and adds utm_content=<reel id> so the
// reel is recorded even on the plain UTM path with no schema change.
function buildLeadFormUrl(agency: any, link: any, opts: any = {}): string {
  const base = publicBaseUrl(opts.baseUrl);
  const agencyKey = agency?.subdomain || agency?.id || '';
  const slug = link?.formSlug ? `/${encodeURIComponent(link.formSlug)}` : '';
  const params = new URLSearchParams();
  params.set('source', 'instagram');
  const token = buildItemToken(link);
  if (token) params.set('item', token);
  if (link?.mediaId) params.set('utm_content', String(link.mediaId));
  if (link?.code) params.set('utm_term', String(link.code));
  return `${base}/lead/${encodeURIComponent(agencyKey)}${slug}?${params.toString()}`;
}

// The wa.me link a reel comment sends when the agency routes reels through WhatsApp. The
// prefilled text is the ONLY carrier of the reel identity on an organic link, and the customer
// can see and edit it — so the code rides inside agency-written copy (see reelRefCode).
function buildWhatsAppHandoffUrl(agency: any, link: any, opts: any = {}): string {
  const digits = String(agency?.whatsappNumber || agency?.phone || '').replace(/[^0-9]/g, '');
  if (!digits || !link?.code) return '';
  const text = reelRefCode.buildHandoffText(opts.template, { item: opts.itemName, code: link.code });
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// What we stamp onto the lead so the CRM shows which reel and which item brought them.
function buildLeadAttribution(link: any, extra: any = {}): any {
  const l = link && typeof link === 'object' ? link : {};
  const stamp: any = {
    source: 'instagram_reel',
    instagramMediaId: l.mediaId || undefined,
    itemType: l.itemType || undefined,
    itemId: l.itemId || undefined,
    refCode: l.code || undefined,
  };
  if (extra && extra.permalink) stamp.instagramPermalink = extra.permalink;
  return stamp;
}

// ── DB lookups (thin) ────────────────────────────────────────────────────────

async function findLinkByMediaId(agencyId: string, mediaId: string) {
  if (!agencyId || !mediaId) return null;
  return CatalogMediaLink.findOne({ where: { agencyId, mediaId, isActive: true } });
}

async function findLinkByCode(agencyId: string, code: string) {
  if (!agencyId || !code) return null;
  return CatalogMediaLink.findOne({ where: { agencyId, code: String(code).toUpperCase(), isActive: true } });
}

// Loads the actual catalog row a link points at (for the item name / PDF). Returns null rather
// than throwing if the item was deleted after being linked — a dangling link degrades to the
// rule's plain reply, it does not break the webhook.
async function loadLinkedItem(link: any) {
  if (!link) return null;
  const Model = ITEM_MODELS[link.itemType];
  if (!Model) return null;
  try {
    return await Model.findOne({ where: { id: link.itemId, agencyId: link.agencyId } });
  } catch {
    return null;
  }
}

// One call the comment handler makes: given a matched comment, does its reel map to an item,
// and if so, what should happen? Returns null when the reel is unmapped (the plain rule reply
// stands, unchanged) and NEVER throws — a resolution failure must not block the DM.
async function resolveReelForComment(agency: any, event: any, opts: any = {}): Promise<any> {
  try {
    const mediaId = event?.mediaId;
    if (!agency?.id || !mediaId) return null;

    const link = await findLinkByMediaId(agency.id, mediaId);
    if (!link) return null;

    const item = await loadLinkedItem(link);
    const action = resolveEffectiveAction(agency, link);
    const itemName = item?.name || item?.title || item?.country || undefined;

    let dmLink = '';
    if (action === 'LEAD_FORM') {
      dmLink = buildLeadFormUrl(agency, link, { baseUrl: opts.baseUrl, itemName });
    } else if (action === 'WHATSAPP') {
      dmLink = buildWhatsAppHandoffUrl(agency, link, { template: opts.whatsappTemplate, itemName });
    }
    // DM_PDF carries no link — the seeded selectedItem drives the agency's SEND_ITEM_DOCUMENT
    // flow when the customer opens the DM.

    return {
      link,
      item,
      action,
      itemName,
      dmLink,
      selectedItem: buildSelectedItem(link, item),
      attribution: buildLeadAttribution(link, { permalink: link.permalink }),
    };
  } catch (err) {
    // Deliberately swallowed: attribution is a nice-to-have on top of the reply, never a gate.
    console.warn(`[ReelResolution] failed for media ${event?.mediaId}: ${(err as any)?.message}`);
    return null;
  }
}

// Stamps the reel onto a customer's active lead. Used by the WhatsApp handoff path, where the
// lead already exists (created by ensureLead) before we know the reel. First-touch-wins: never
// overwrites an attribution already on the lead. Returns the lead, or null if none/failed —
// attribution must never block the conversation.
async function stampReelOnLead(agencyId: string, customerId: string, attribution: any) {
  try {
    if (!agencyId || !customerId || !attribution) return null;
    const lead = await Lead.findOne({
      where: { agencyId, customerId, status: ACTIVE_LEAD_STATUSES },
      order: [['updatedAt', 'DESC']],
    });
    if (!lead) return null;

    const existing = lead.customTripDetails?.reelAttribution;
    if (existing?.instagramMediaId) return lead; // first-touch wins

    const patch: any = {
      source: lead.source && lead.source !== 'whatsapp' ? lead.source : 'instagram_reel',
      customTripDetails: { ...(lead.customTripDetails || {}), reelAttribution: attribution },
    };
    if (!lead.propertyId && attribution.itemType === 'PROPERTY') patch.propertyId = attribution.itemId;
    if (!lead.packageId && attribution.itemType === 'PACKAGE') patch.packageId = attribution.itemId;

    await lead.update(patch);
    return lead;
  } catch (err) {
    console.warn(`[ReelResolution] could not stamp lead for customer ${customerId}: ${(err as any)?.message}`);
    return null;
  }
}

module.exports = {
  VALID_ACTIONS,
  DEFAULT_ACTION,
  ACTIVE_LEAD_STATUSES,
  stampReelOnLead,
  resolveEffectiveAction,
  buildItemToken,
  buildSelectedItem,
  buildLeadAttribution,
  buildLeadFormUrl,
  buildWhatsAppHandoffUrl,
  findLinkByMediaId,
  findLinkByCode,
  loadLinkedItem,
  resolveReelForComment,
};
