// Normalizes an inbound Instagram comment event into the flat shape the automation
// service expects.
//
// Two producers disagree on shape. Marketing OS forwards Meta's raw `entry.changes[].value`
// (`{ id, text, from: {id}, media: {id} }`), while instagramAutomationService reads
// `event.accountId` / `event.mediaId`. accountId appears nowhere in the raw shape, so every
// real comment threw INVALID_INSTAGRAM_COMMENT_EVENT into a catch that only logged.
//
// So: accept both shapes, and when an event genuinely cannot be automated, say WHY rather
// than throwing. A skip we can read in the logs beats an exception nobody sees.

const str = (...vals) => {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
};

function normalizeCommentEvent(raw) {
  const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const media = d.media && typeof d.media === 'object' ? d.media : {};
  const from = d.from && typeof d.from === 'object' ? d.from : {};

  // The IG account this comment belongs to. `accountId` is Marketing OS's internal account
  // row id (what travel-bot's rules are keyed on); `igAccountId` is Meta's numeric IG user id
  // (what a commenter's `from.id` is comparable against). They are NOT interchangeable — the
  // self-reply guard depends on keeping them apart.
  const igAccountId = str(d.igAccountId, d.instagramAccountId);
  const accountId = str(d.accountId, igAccountId);

  return {
    accountId,
    igAccountId,
    commentId: str(d.commentId, d.igCommentId, d.id),
    mediaId: str(d.mediaId, d.igMediaId, media.id),
    mediaProductType: str(d.mediaProductType, media.media_product_type),
    parentId: str(d.parentId, d.parent_id),
    fromId: str(d.fromId, d.commenterId, from.id),
    fromUsername: str(d.fromUsername, d.commenterUsername, from.username),
    text: str(d.text, d.message),
    verb: str(d.verb).toLowerCase(),
    raw: d,
  };
}

// Returns '' when the event is safe to automate, otherwise a human-readable reason.
function commentEventSkipReason(event) {
  const e = event && typeof event === 'object' ? event : {};

  if (!e.commentId) return 'missing commentId';
  if (!e.fromId) return 'missing commenter id';
  if (!e.accountId) {
    return 'missing accountId — Marketing OS is sending the raw Meta comment shape; '
      + 'deploy the partner-dispatch fix in WebhookService.ts';
  }

  // Our own reply to a comment arrives back as a comment. Automating it would DM ourselves
  // and, with a rule that matches broadly, loop.
  if (e.igAccountId && e.fromId === e.igAccountId) {
    return 'comment is from our own connected account — skipping to avoid a self-reply loop';
  }

  // Meta omits `verb` on some payloads; absent means a new comment. Edits and deletes are
  // not new enquiries and must not re-trigger a DM.
  if (e.verb && e.verb !== 'add') return `verb=${e.verb} — not a new comment`;

  return '';
}

module.exports = { normalizeCommentEvent, commentEventSkipReason };
