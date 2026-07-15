// Click-to-WhatsApp (CTWA) ad attribution.
//
// When several Meta ads all point to the same WhatsApp number, Meta still tells us
// which ad a person clicked: the first inbound message after the click carries a
// `referral` object whose `source_id` is the unique ad ID. This service stamps that
// attribution onto the lead (instantly, using the ad headline as a never-blank label)
// and then best-effort resolves the real Ads-Manager ad/campaign name in the
// background. First touch wins per lead — we never overwrite an already-attributed
// lead, so historical attribution is preserved.

const { Lead, Customer } = require('../models');
const metaAdsService = require('./metaAdsService');
const reelResolutionService = require('./reelResolutionService');

function clean(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function platformFromReferral(referral = {}) {
  const url = String(referral.source_url || referral.sourceUrl || '').toLowerCase();
  if (url.includes('instagram') || url.includes('ig.me')) return 'instagram';
  return 'facebook';
}

function leadSourceForPlatform(platform) {
  return platform === 'instagram' ? 'instagram_ad' : 'facebook_ad';
}

// Sources that represent an unknown/organic first touch and may be upgraded to an ad.
const UPGRADEABLE_SOURCES = [null, '', 'whatsapp', 'whatsapp_organic'];

/**
 * Normalize the raw WhatsApp Cloud `referral` object into the fields we persist.
 */
function normalizeReferral(referral = {}) {
  const adId = clean(referral.source_id || referral.sourceId);
  if (!adId) return null;
  const platform = platformFromReferral(referral);
  return {
    adId,
    headline: clean(referral.headline),
    body: clean(referral.body),
    sourceUrl: clean(referral.source_url || referral.sourceUrl),
    sourceType: clean(referral.source_type || referral.sourceType) || 'ad',
    ctwaClid: clean(referral.ctwa_clid || referral.ctwaClid),
    mediaType: clean(referral.media_type || referral.mediaType),
    platform,
    raw: referral,
  };
}

/**
 * Stamp CTWA ad attribution onto the customer's most recent lead, then kick off
 * background name enrichment. Safe to call on every inbound message — it no-ops when
 * there is no referral or the lead is already attributed.
 *
 * @param {string} agencyId
 * @param {string} customerId
 * @param {object} rawReferral - msg.referral from the WhatsApp webhook
 * @returns {Promise<object|null>} the updated lead, or null when nothing was applied
 */
async function applyCtwaReferral(agencyId, customerId, rawReferral) {
  const ref = normalizeReferral(rawReferral);
  if (!ref || !agencyId || !customerId) return null;

  const lead = await Lead.findOne({
    where: { agencyId, customerId },
    order: [['createdAt', 'DESC']],
  });
  if (!lead) return null;

  // First touch wins: never overwrite an already-attributed lead.
  if (lead.adId) return lead;

  const sourcePatch = UPGRADEABLE_SOURCES.includes(lead.source)
    ? { source: leadSourceForPlatform(ref.platform) }
    : {};

  await lead.update({
    adId: ref.adId,
    metaAdId: ref.adId,
    adHeadline: ref.headline,
    metaAdName: ref.headline, // initial label; upgraded by enrichment below
    adSourceUrl: ref.sourceUrl,
    metaPlatform: ref.platform,
    metaRawPayload: {
      ...(lead.metaRawPayload || {}),
      ctwaReferral: {
        adId: ref.adId,
        headline: ref.headline,
        body: ref.body,
        sourceUrl: ref.sourceUrl,
        sourceType: ref.sourceType,
        ctwaClid: ref.ctwaClid,
        mediaType: ref.mediaType,
        platform: ref.platform,
        capturedAt: new Date().toISOString(),
      },
    },
    ...sourcePatch,
  });

  // Tag the customer too, so a repeat caller keeps their first-touch ad source.
  try {
    const customer = await Customer.findByPk(customerId);
    if (customer && UPGRADEABLE_SOURCES.includes(customer.source)) {
      await customer.update({ source: leadSourceForPlatform(ref.platform) });
    }
  } catch (_err) {
    /* non-fatal */
  }

  // Background: resolve the real ad/campaign name without blocking the reply.
  enrichAdReference(agencyId, lead.id, ref.adId).catch((err) => {
    console.warn('[adReferral] enrichment failed:', err?.message || err);
  });

  return lead;
}

/**
 * Best-effort: resolve the ad ID to its Ads-Manager ad name + campaign and persist
 * the friendlier labels. Silently does nothing when Meta cannot resolve the ad.
 */
async function enrichAdReference(agencyId, leadId, adId) {
  const reference = await metaAdsService.resolveAdReference(agencyId, adId);
  if (!reference) return null;

  const lead = await Lead.findOne({ where: { id: leadId, agencyId } });
  if (!lead) return null;

  const patch = {};
  if (reference.metaAdName) patch.metaAdName = reference.metaAdName;
  if (reference.metaAdSetId) patch.metaAdSetId = reference.metaAdSetId;
  if (reference.metaAdSetName) patch.metaAdSetName = reference.metaAdSetName;
  if (reference.metaCampaignId) patch.metaCampaignId = reference.metaCampaignId;
  if (reference.metaCampaignName) patch.metaCampaignName = reference.metaCampaignName;
  if (reference.metaAdAccountId) patch.metaAdAccountId = reference.metaAdAccountId;
  if (reference.metaPlatform) patch.metaPlatform = reference.metaPlatform;

  if (Object.keys(patch).length) await lead.update(patch);

  // If this ad was boosted from an Instagram reel that maps to a catalog item, attribute the
  // lead to that reel/item — the paid-ad twin of the organic comment path, but the reel id is
  // hidden metadata the customer never sees. Best-effort: never blocks name enrichment.
  if (reference.instagramMediaId) {
    try {
      const link = await reelResolutionService.findLinkByMediaId(agencyId, reference.instagramMediaId);
      if (link) {
        const attribution = reelResolutionService.buildLeadAttribution(link, {
          permalink: link.permalink || reference.instagramPermalink,
        });
        await reelResolutionService.stampReelOnLead(agencyId, lead.customerId, attribution);
      }
    } catch (err) {
      console.warn('[adReferral] reel attribution failed:', err?.message || err);
    }
  }

  return lead;
}

module.exports = {
  applyCtwaReferral,
  enrichAdReference,
  normalizeReferral,
};
