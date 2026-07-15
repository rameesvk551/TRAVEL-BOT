// Test entry point.  Run with:  npm test
//
// Deliberately dependency-free — these tests are static/pure (no DB, no network), so they run
// anywhere, including on the prod box, and are safe to run before a deploy.

require('./flowGraph.test');
require('./leadForm.test');
require('./brochureDoc.test');
require('./greetingRestart.test');
require('./bookingRevenue.test');
require('./instagramCommentEvent.test');
require('./reelRefCode.test');
require('./reelResolution.test');
require('./catalogMediaLink.test');

const { run } = require('./_harness');

console.log('\n\x1b[1m  travel-bot — flow builder, lead capture, brochure builder & reporting\x1b[0m');
run();
