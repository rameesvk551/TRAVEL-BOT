require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});

const TENANT_SLUG = 'getouthouse-in-129ff333';

async function graph(path, accessToken, params = {}) {
  const apiVersion = process.env.INSTAGRAM_API_VERSION || process.env.WHATSAPP_API_VERSION || 'v24.0';
  const url = new URL(`https://graph.instagram.com/${apiVersion}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function fbGraph(path, accessToken, params = {}) {
  const apiVersion = process.env.INSTAGRAM_API_VERSION || process.env.WHATSAPP_API_VERSION || 'v24.0';
  const url = new URL(`https://graph.facebook.com/${apiVersion}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function main() {
  const tenantResult = await pool.query('SELECT id, name, slug FROM tenants WHERE slug = $1', [TENANT_SLUG]);
  const tenant = tenantResult.rows[0];
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`);

  const accountResult = await pool.query(
    `SELECT id, ig_user_id, username, status, access_token, token_expires_at, page_id, account_type
       FROM instagram_accounts
      WHERE tenant_id = $1
      ORDER BY connected_at DESC NULLS LAST
      LIMIT 1`,
    [tenant.id]
  );
  const account = accountResult.rows[0];
  if (!account) throw new Error(`Instagram account not found for tenant ${TENANT_SLUG}`);
  if (!account.access_token) throw new Error(`Instagram account ${account.id} has no access token`);

  const profile = await graph('/me', account.access_token, {
    fields: 'id,user_id,username,account_type',
  });
  const permissions = await graph('/me/permissions', account.access_token);
  const subscriptions = await graph('/me/subscribed_apps', account.access_token);
  const fbTokenDebug = process.env.META_APP_ID && process.env.META_APP_SECRET
    ? await fbGraph('/debug_token', `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`, {
      input_token: account.access_token,
    })
    : { ok: false, status: 0, data: { error: 'META_APP_ID/META_APP_SECRET missing' } };

  console.log(JSON.stringify({
    tenant,
    account: {
      id: account.id,
      igUserId: account.ig_user_id,
      username: account.username,
      status: account.status,
      accountType: account.account_type,
      pageId: account.page_id,
      tokenExpiresAt: account.token_expires_at,
      tokenPresent: Boolean(account.access_token),
    },
    profile,
    permissions,
    subscriptions,
    tokenDebug: fbTokenDebug.ok ? {
      ok: fbTokenDebug.ok,
      status: fbTokenDebug.status,
      data: {
        app_id: fbTokenDebug.data?.data?.app_id,
        type: fbTokenDebug.data?.data?.type,
        application: fbTokenDebug.data?.data?.application,
        expires_at: fbTokenDebug.data?.data?.expires_at,
        is_valid: fbTokenDebug.data?.data?.is_valid,
        scopes: fbTokenDebug.data?.data?.scopes,
        granular_scopes: fbTokenDebug.data?.data?.granular_scopes,
        user_id: fbTokenDebug.data?.data?.user_id,
      },
    } : fbTokenDebug,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
