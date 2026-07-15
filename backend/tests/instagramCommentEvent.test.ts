// Instagram comment automation has never fired in production.
//
// Marketing OS dispatches the partner webhook with Meta's RAW comment shape
// (`{ id, text, from: {id, username}, media: {id} }`) while
// instagramAutomationService.processCommentEvent reads a FLAT shape
// (`event.accountId`, `event.mediaId`). accountId is absent at every level of the
// raw shape, so the service threw INVALID_INSTAGRAM_COMMENT_EVENT on every real
// comment — and bot/src/webhook.js swallowed the throw. Two rule stacks shipped six
// weeks apart against payload shapes that never matched.
//
// The normalizer accepts BOTH shapes so travel-bot is not hostage to which version of
// Marketing OS is deployed, and reports a REASON when an event is unusable instead of
// throwing into a catch that nobody reads.

const path = require('path');
const { describe, ok, equal } = require('./_harness');

const ig = require(path.resolve(__dirname, '../../bot/src/utils/instagramCommentEvent.js'));

// Exactly what Meta puts in `entry.changes[].value` for field=comments, which is what
// Marketing OS forwards today as `data`.
const RAW_META_SHAPE = {
  from: { id: '178414123', username: 'wanderlust_ria' },
  media: { id: '17891234567890123', media_product_type: 'REELS' },
  id: '17925550001112223',
  parent_id: undefined,
  text: 'price?',
  verb: 'add',
  created_time: 1_752_000_000,
};

// What the message dispatcher already sends, and what the comment dispatcher must mirror.
const FLAT_PARTNER_SHAPE = {
  accountId: '9c1f8a2e-4b7d-11ef-b3a1-0242ac120002',
  igAccountId: '17841400000000000',
  commentId: '17925550001112223',
  igCommentId: '17925550001112223',
  mediaId: '17891234567890123',
  igMediaId: '17891234567890123',
  fromId: '178414123',
  fromUsername: 'wanderlust_ria',
  text: 'price?',
};

describe('the flat partner shape normalizes cleanly', () => {
  const e = ig.normalizeCommentEvent(FLAT_PARTNER_SHAPE);
  equal('accountId', e.accountId, '9c1f8a2e-4b7d-11ef-b3a1-0242ac120002');
  equal('igAccountId is kept distinct from accountId', e.igAccountId, '17841400000000000');
  equal('mediaId (the reel)', e.mediaId, '17891234567890123');
  equal('commentId', e.commentId, '17925550001112223');
  equal('fromId', e.fromId, '178414123');
  equal('fromUsername', e.fromUsername, 'wanderlust_ria');
  equal('text', e.text, 'price?');
  equal('usable', ig.commentEventSkipReason(e), '');
});

describe('the raw Meta shape is understood, not dropped', () => {
  const e = ig.normalizeCommentEvent(RAW_META_SHAPE);
  equal('media.id is lifted to mediaId — THE reel id the whole feature hangs on', e.mediaId, '17891234567890123');
  equal('the bare `id` is the comment id', e.commentId, '17925550001112223');
  equal('from.id is lifted', e.fromId, '178414123');
  equal('from.username is lifted', e.fromUsername, 'wanderlust_ria');
  equal('media_product_type is lifted (REELS vs FEED)', e.mediaProductType, 'REELS');
});

describe('an unusable event names its reason instead of throwing', () => {
  // This is the production bug, reproduced: raw shape carries no accountId anywhere.
  const raw = ig.normalizeCommentEvent(RAW_META_SHAPE);
  ok(
    'raw Meta shape is skipped for a MISSING accountId (the exact prod failure)',
    ig.commentEventSkipReason(raw).includes('accountId'),
    ig.commentEventSkipReason(raw),
  );
  ok(
    'and the reason points at the fix, not just the symptom',
    ig.commentEventSkipReason(raw).toLowerCase().includes('marketing os'),
    ig.commentEventSkipReason(raw),
  );

  equal(
    'no comment id -> skipped',
    ig.commentEventSkipReason(ig.normalizeCommentEvent({ accountId: 'a', fromId: 'f' })),
    'missing commentId',
  );
  equal(
    'no commenter -> skipped (we would have nobody to DM)',
    ig.commentEventSkipReason(ig.normalizeCommentEvent({ accountId: 'a', commentId: 'c' })),
    'missing commenter id',
  );
  equal('garbage in -> a reason, never a crash', typeof ig.commentEventSkipReason(ig.normalizeCommentEvent(null)), 'string');
  equal('undefined in -> a reason, never a crash', typeof ig.commentEventSkipReason(ig.normalizeCommentEvent(undefined)), 'string');
});

describe('we never automate our own comments (self-reply loop guard)', () => {
  const selfComment = ig.normalizeCommentEvent({
    ...FLAT_PARTNER_SHAPE,
    fromId: '17841400000000000', // same as igAccountId — this is the agency's own reply
  });
  ok(
    'a comment from the connected account itself is skipped',
    ig.commentEventSkipReason(selfComment).toLowerCase().includes('own'),
    ig.commentEventSkipReason(selfComment),
  );
});

describe('edits and deletes are not new enquiries', () => {
  const removed = ig.normalizeCommentEvent({ ...FLAT_PARTNER_SHAPE, verb: 'remove' });
  ok(
    'verb=remove is skipped',
    ig.commentEventSkipReason(removed).includes('remove'),
    ig.commentEventSkipReason(removed),
  );
  equal(
    'verb=add is the happy path',
    ig.commentEventSkipReason(ig.normalizeCommentEvent({ ...FLAT_PARTNER_SHAPE, verb: 'add' })),
    '',
  );
  equal(
    'an absent verb is treated as a new comment (Meta omits it on some payloads)',
    ig.commentEventSkipReason(ig.normalizeCommentEvent(FLAT_PARTNER_SHAPE)),
    '',
  );
});
