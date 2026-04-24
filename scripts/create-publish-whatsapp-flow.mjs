import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import axios from 'axios';

const DEFAULT_SERVER_DIR = process.env.MARKETING_OS_SERVER_DIR || '/home/ec2-user/marketting-os/marketing-os-server';
const DEFAULT_ENDPOINT_URL = process.env.WHATSAPP_FLOW_ENDPOINT_URL || 'https://travelbot.wayon.in/api/whatsapp/flow';
const DEFAULT_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v24.0';
const DEFAULT_RETRY_COUNT = 3;

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function asInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fail(message) {
  throw new Error(message);
}

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Flow JSON file not found at ${filePath}`);
  }
}

function sanitize(data) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'string' && /^Bearer\s+/i.test(value)) return '[redacted]';
    if (key === 'access_token') return '[redacted]';
    return value;
  }));
}

async function importServerModule(serverDir, relativePath) {
  const fullPath = path.resolve(serverDir, relativePath);
  return import(pathToFileURL(fullPath).href);
}

function decodePrivateKey(raw) {
  const value = String(raw || '').trim();
  if (!value) fail('WHATSAPP_FLOW_PRIVATE_KEY is required');
  return value.startsWith('LS0t') ? Buffer.from(value, 'base64').toString('utf8') : value;
}

function getPublicKeyPem() {
  const privateKey = crypto.createPrivateKey(decodePrivateKey(process.env.WHATSAPP_FLOW_PRIVATE_KEY));
  return crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
}

function shouldSkipPublicKeyUpload() {
  const raw = readArg('skip-public-key-upload', '');
  return ['1', 'true', 'yes'].includes(String(raw).toLowerCase());
}

async function graphFetch(url, token, { method = 'GET', body, isForm = false } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(body && typeof body.getHeaders === 'function' ? body.getHeaders() : {}),
    },
    body: body
      ? (typeof body.getHeaders === 'function' ? body : JSON.stringify(body))
      : undefined,
  });

  const payload = await response.json().catch(async () => ({
    message: await response.text(),
  }));

  return {
    ok: response.ok,
    status: response.status,
    data: sanitize(payload),
  };
}

async function uploadPublicKey(phoneNumberId, token, apiVersion) {
  return graphFetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/whatsapp_business_encryption`,
    token,
    {
      method: 'POST',
      body: { business_public_key: getPublicKeyPem() },
    }
  );
}

async function createFlow(wabaId, flowName, token, apiVersion, categories) {
  return graphFetch(
    `https://graph.facebook.com/${apiVersion}/${wabaId}/flows`,
    token,
    {
      method: 'POST',
      body: { name: flowName, categories },
    }
  );
}

async function uploadFlowAsset(flowId, flowJsonPath, token, apiVersion) {
  const { default: FormData } = await import('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(flowJsonPath), {
    filename: path.basename(flowJsonPath),
    contentType: 'application/json',
  });
  form.append('name', 'flow.json');
  form.append('asset_type', 'FLOW_JSON');

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${flowId}/assets`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
        maxBodyLength: Infinity,
      }
    );

    return {
      ok: true,
      status: response.status,
      data: sanitize(response.data),
    };
  } catch (error) {
    return {
      ok: false,
      status: error.response?.status || 500,
      data: sanitize(error.response?.data || { message: error.message || String(error) }),
    };
  }
}

async function updateFlowMetadata(flowId, token, apiVersion, endpointUrl) {
  return graphFetch(
    `https://graph.facebook.com/${apiVersion}/${flowId}`,
    token,
    {
      method: 'POST',
      body: { endpoint_uri: endpointUrl },
    }
  );
}

async function getFlowDetails(flowId, token, apiVersion) {
  return graphFetch(
    `https://graph.facebook.com/${apiVersion}/${flowId}?fields=id,name,status,categories,validation_errors,health_status,json_version,data_api_version,endpoint_uri`,
    token
  );
}

async function publishFlow(flowId, token, apiVersion) {
  return graphFetch(
    `https://graph.facebook.com/${apiVersion}/${flowId}/publish`,
    token,
    {
      method: 'POST',
      body: {},
    }
  );
}

async function main() {
  const serverDir = path.resolve(readArg('server-dir', DEFAULT_SERVER_DIR));
  const flowJsonPath = path.resolve(readArg('flow-json'));
  const flowName = readArg('flow-name');
  const endpointUrl = readArg('endpoint-url', DEFAULT_ENDPOINT_URL);
  const apiVersion = readArg('api-version', DEFAULT_API_VERSION);
  const tenantId = readArg('tenant-id');
  const wabaIdArg = readArg('waba-id');
  const flowIdArg = readArg('flow-id');
  const retries = asInt(readArg('retries', DEFAULT_RETRY_COUNT), DEFAULT_RETRY_COUNT);
  const categories = String(readArg('categories', 'OTHER'))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const skipPublicKeyUpload = shouldSkipPublicKeyUpload();

  if (!tenantId && !wabaIdArg) fail('Pass either --tenant-id or --waba-id');
  if (!flowName && !flowIdArg) fail('Pass --flow-name when creating a new flow');
  ensureFile(flowJsonPath);

  const db = await importServerModule(serverDir, 'dist/db/sqlmodels/index.js');
  const security = await importServerModule(serverDir, 'dist/modules/whatsapp/security/tokenCipher.js');
  const { decryptSecret } = security;

  const config = tenantId
    ? await db.default.WhatsappBusinessConfig.findOne({ where: { tenant_id: tenantId }, raw: true })
    : await db.default.WhatsappBusinessConfig.findOne({ where: { waba_id: wabaIdArg }, raw: true });

  if (!config) fail('WhatsApp config not found for the supplied tenant/WABA');
  if (!config.access_token || !config.phone_number_id || !config.waba_id) {
    fail('WhatsApp config is missing access token, phone number ID, or WABA ID');
  }

  const token = decryptSecret(config.access_token);
  const result = {
    tenantId: config.tenant_id,
    wabaId: config.waba_id,
    phoneNumberId: config.phone_number_id,
    flowName,
    flowJsonPath,
    endpointUrl,
    steps: {},
  };

  if (skipPublicKeyUpload || !String(process.env.WHATSAPP_FLOW_PRIVATE_KEY || '').trim()) {
    result.steps.uploadPublicKey = {
      ok: true,
      status: 200,
      data: {
        skipped: true,
        reason: skipPublicKeyUpload ? 'flag_enabled' : 'missing_private_key',
      },
    };
  } else {
    result.steps.uploadPublicKey = await uploadPublicKey(config.phone_number_id, token, apiVersion);
  }

  let flowId = flowIdArg;
  if (!flowId) {
    result.steps.createFlow = await createFlow(config.waba_id, flowName, token, apiVersion, categories);
    if (!result.steps.createFlow.ok) fail(`Flow creation failed: ${JSON.stringify(result.steps.createFlow.data)}`);
    flowId = result.steps.createFlow.data?.id;
  } else {
    result.steps.createFlow = { ok: true, status: 200, data: { id: flowId, reused: true } };
  }

  if (!flowId) fail('Meta did not return a flow ID');
  result.flowId = flowId;

  result.steps.uploadFlowAsset = await uploadFlowAsset(flowId, flowJsonPath, token, apiVersion);
  if (!result.steps.uploadFlowAsset.ok) fail(`Flow asset upload failed: ${JSON.stringify(result.steps.uploadFlowAsset.data)}`);

  result.steps.updateFlowMetadata = await updateFlowMetadata(flowId, token, apiVersion, endpointUrl);
  if (!result.steps.updateFlowMetadata.ok) fail(`Flow metadata update failed: ${JSON.stringify(result.steps.updateFlowMetadata.data)}`);

  result.publishAttempts = [];
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const publishResult = await publishFlow(flowId, token, apiVersion);
    const details = await getFlowDetails(flowId, token, apiVersion);
    result.publishAttempts.push({
      attempt,
      publish: publishResult,
      details,
    });

    if (publishResult.ok && details.ok && String(details.data?.status || '').toUpperCase() === 'PUBLISHED') {
      result.finalDetails = details;
      console.log(JSON.stringify(result, null, 2));
      await db.default.sequelize.close();
      return;
    }
  }

  result.finalDetails = await getFlowDetails(flowId, token, apiVersion);
  console.log(JSON.stringify(result, null, 2));
  await db.default.sequelize.close();
  process.exitCode = 1;
}

main().catch(async (error) => {
  const payload = error?.response?.data || { message: error.message || String(error) };
  console.error(JSON.stringify({ ok: false, error: sanitize(payload) }, null, 2));
  process.exitCode = 1;
});
