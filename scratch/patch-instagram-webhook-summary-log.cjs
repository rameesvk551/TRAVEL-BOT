const fs = require('fs');
const path = require('path');

const target = path.resolve(
  process.cwd(),
  'dist/modules/instagram/services/WebhookService.js'
);
const backup = `${target}.bak-webhook-summary-${new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, '')
  .slice(0, 14)}`;

const source = fs.readFileSync(target, 'utf8');

let next = source.replace(
  `            const entries = body.entry || [];
            for (const entry of entries) {`,
  `            const entries = body.entry || [];
            const summary = entries.map((entry) => {
                const fields = (entry.changes || []).map((change) => change.field).join(',') || 'none';
                return \`\${entry.id || 'unknown'}:changes=\${fields}:messaging=\${(entry.messaging || []).length}\`;
            }).join('; ');
            logger.info(\`[IG Webhook] Received object=\${object} entries=\${entries.length} summary=\${summary || 'empty'}\`);
            for (const entry of entries) {`
);

next = next.replace(
  "                    logger.debug(`[IG Webhook] Received event for unconnected account ${igAccountId}`);",
  "                    logger.warn(`[IG Webhook] Received event for unconnected account ${igAccountId}`);"
);

next = next.replace(
  "                            default:\n                                logger.debug(`[IG Webhook] Unhandled change field: ${change.field}`);",
  "                            default:\n                                logger.warn(`[IG Webhook] Unhandled change field: ${change.field}`);"
);

if (next === source) {
  console.log(JSON.stringify({ patched: false, reason: 'target text not found or already patched', target }, null, 2));
  process.exit(0);
}

fs.copyFileSync(target, backup);
fs.writeFileSync(target, next);

console.log(JSON.stringify({ patched: true, target, backup }, null, 2));
