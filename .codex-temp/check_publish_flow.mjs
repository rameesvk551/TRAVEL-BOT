import db from 'file:///home/ec2-user/marketting-os/marketing-os-server/dist/db/sqlmodels/index.js';
import { decryptSecret } from 'file:///home/ec2-user/marketting-os/marketing-os-server/dist/modules/whatsapp/security/tokenCipher.js';

const flowId = process.env.FLOW_ID || '974026305160629';
const wabaId = process.env.WABA_ID || '2478492146002706';
const apiVersion = process.env.META_API_VERSION || 'v24.0';

function sanitize(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (typeof value === 'string' && /Bearer\s+/i.test(value)) return '[redacted]';
      if (['access_token', 'Authorization'].includes(key)) return '[redacted]';
      return value;
    })
  );
}

async function call(token, method, url, data) {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: data && method !== 'GET' ? JSON.stringify(data) : undefined,
    });
    const body = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data: sanitize(body),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      data: sanitize({ message: error.message }),
    };
  }
}

async function main() {
  const row = await db.WhatsappBusinessConfig.findOne({ where: { waba_id: wabaId } });
  if (!row) {
    console.log(JSON.stringify({ ok: false, reason: 'WABA_CONFIG_NOT_FOUND', wabaId }, null, 2));
    return;
  }

  const raw = row.toJSON();
  const token = raw.access_token ? decryptSecret(raw.access_token) : null;
  if (!token) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: 'TOKEN_MISSING',
          wabaId,
          tenantId: raw.tenant_id,
        },
        null,
        2
      )
    );
    return;
  }

  const detailsUrl = `https://graph.facebook.com/${apiVersion}/${flowId}?fields=id,name,status,validation_errors,health_status,categories,data_api_version,endpoint_uri`;
  const publishUrl = `https://graph.facebook.com/${apiVersion}/${flowId}/publish`;
  const details = await call(token, 'get', detailsUrl);
  const publish = await call(token, 'post', publishUrl, {});

  console.log(
    JSON.stringify(
      {
        wabaId,
        tenantId: raw.tenant_id,
        phoneNumberId: raw.phone_number_id,
        flowId,
        details,
        publish,
      },
      null,
      2
    )
  );
}

try {
  await main();
} finally {
  await db.sequelize.close();
}
