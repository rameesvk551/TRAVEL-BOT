import fs from 'fs';

import db from 'file:///home/ec2-user/marketting-os/marketing-os-server/dist/db/sqlmodels/index.js';
import { decryptSecret } from 'file:///home/ec2-user/marketting-os/marketing-os-server/dist/modules/whatsapp/security/tokenCipher.js';

const apiVersion = process.env.WHATSAPP_API_VERSION || 'v24.0';
const endpointUrl = process.env.WHATSAPP_FLOW_ENDPOINT_URL || 'https://travelbot.wayon.in/api/whatsapp/flow';

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}

async function graphFetch(url, token, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  });

  const data = await response.json().catch(async () => ({ message: await response.text() }));
  return { ok: response.ok, status: response.status, data };
}

async function main() {
  const wabaId = readArg('waba-id');
  const flowId = readArg('flow-id');
  const flowJsonPath = readArg('flow-json');

  if (!wabaId || !flowId || !flowJsonPath) {
    throw new Error('Usage: node direct-update-flow.mjs --waba-id <waba> --flow-id <flowId> --flow-json <path>');
  }

  const config = await db.WhatsappBusinessConfig.findOne({ where: { waba_id: wabaId }, raw: true });
  if (!config) throw new Error(`WhatsApp config not found for waba ${wabaId}`);

  const token = decryptSecret(config.access_token);
  if (!token) throw new Error('Could not decrypt tenant access token');

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(flowJsonPath)], { type: 'application/json' }), 'flow.json');
  form.append('name', 'flow.json');
  form.append('asset_type', 'FLOW_JSON');

  const assetResult = await graphFetch(
    `https://graph.facebook.com/${apiVersion}/${flowId}/assets`,
    token,
    {
      method: 'POST',
      body: form,
    }
  );
  if (!assetResult.ok) {
    throw new Error(`Flow asset upload failed: ${JSON.stringify(assetResult.data)}`);
  }

  const updateResult = await graphFetch(
    `https://graph.facebook.com/${apiVersion}/${flowId}`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint_uri: endpointUrl }),
    }
  );
  if (!updateResult.ok) {
    throw new Error(`Flow metadata update failed: ${JSON.stringify(updateResult.data)}`);
  }

  const publishResult = await graphFetch(
    `https://graph.facebook.com/${apiVersion}/${flowId}/publish`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  if (!publishResult.ok) {
    throw new Error(`Flow publish failed: ${JSON.stringify(publishResult.data)}`);
  }

  const detailsResult = await graphFetch(
    `https://graph.facebook.com/${apiVersion}/${flowId}?fields=id,name,status,validation_errors,health_status,endpoint_uri`,
    token
  );

  console.log(JSON.stringify({
    wabaId: config.waba_id,
    flowId,
    assetResult,
    updateResult,
    publishResult,
    detailsResult,
  }, null, 2));
}

try {
  await main();
} finally {
  await db.sequelize.close();
}
