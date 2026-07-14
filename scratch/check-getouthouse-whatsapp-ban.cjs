const fs = require('fs');
const dotenv = require('dotenv');
const { Client } = require('pg');

function readEnv(path) {
  return dotenv.parse(fs.readFileSync(path));
}

function redactConfig(row) {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...row };
  delete copy.access_token;
  delete copy.token;
  delete copy.refresh_token;
  delete copy.app_secret;
  delete copy.password;
  return copy;
}

async function graphGet(apiVersion, id, accessToken, fields) {
  const url = new URL(`https://graph.facebook.com/${apiVersion}/${id}`);
  if (fields) url.searchParams.set('fields', fields);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json().catch(async () => ({ message: await response.text() }));
  return { ok: response.ok, status: response.status, data };
}

async function graphDebugToken(apiVersion, appId, appSecret, inputToken) {
  if (!appId || !appSecret || !inputToken) return null;
  const url = new URL(`https://graph.facebook.com/${apiVersion}/debug_token`);
  url.searchParams.set('input_token', inputToken);
  url.searchParams.set('access_token', `${appId}|${appSecret}`);
  const response = await fetch(url);
  const data = await response.json().catch(async () => ({ message: await response.text() }));
  return { ok: response.ok, status: response.status, data };
}

async function searchPartnerTenants(baseUrl, apiKey, search) {
  if (!baseUrl || !apiKey || !search) return [];
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL('tenants', normalizedBase);
  url.searchParams.set('search', search);
  url.searchParams.set('limit', '25');
  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json().catch(async () => ({ message: await response.text() }));
  return Array.isArray(data?.data?.tenants) ? data.data.tenants : [];
}

async function main() {
  const tbEnv = readEnv('/home/ec2-user/travel-bot-git/.env');
  const mosEnv = readEnv('/home/ec2-user/marketting-os/marketing-os-server/.env');

  const tbDbUrl = tbEnv.DATABASE_URL;
  const partnerApiBase = tbEnv.MARKETING_OS_PARTNER_API_BASE_URL;
  const partnerApiKey = tbEnv.MARKETING_OS_PARTNER_API_KEY;
  const mosDbUrl = mosEnv.DATABASE_URL || mosEnv.POSTGRES_URL;
  const apiVersion = mosEnv.WHATSAPP_API_VERSION || mosEnv.META_API_VERSION || 'v24.0';
  const metaAppId = mosEnv.META_APP_ID || mosEnv.INSTAGRAM_APP_ID || '';
  const metaAppSecret = mosEnv.META_APP_SECRET || mosEnv.INSTAGRAM_APP_SECRET || '';

  const tb = new Client({ connectionString: tbDbUrl });
  const mos = new Client({ connectionString: mosDbUrl });
  await tb.connect();
  await mos.connect();

  try {
    const agencyRes = await tb.query(
      `select id, name, email, subdomain, custom_domain, whatsapp_provider,
              marketing_os_tenant_id, whatsapp_connection_status, whatsapp_connection_error
         from agencies
        where name ilike $1 or email ilike $2 or subdomain ilike $2 or custom_domain ilike $2
        order by updated_at desc
        limit 1`,
      ['%GetOutHouse%', '%getouthouse%']
    );

    const agency = agencyRes.rows[0];
    if (!agency) {
      throw new Error('GetOutHouse agency not found in TravelBot');
    }

    const channelsRes = await tb.query(
      `select id, agency_id, label, is_default, is_active, whatsapp_provider,
              whatsapp_number, whatsapp_display_phone_number, whatsapp_phone_number_id,
              whatsapp_business_account_id, whatsapp_connection_status, whatsapp_connection_error,
              marketing_os_tenant_id, whatsapp_coexistence_status, whatsapp_contact_sync_status,
              whatsapp_history_sync_status, whatsapp_coexistence_last_synced_at, whatsapp_last_synced_at
         from agency_channels
        where agency_id = $1
        order by is_default desc, updated_at desc nulls last, created_at desc`,
      [agency.id]
    );

    let tenant = agency.marketing_os_tenant_id
      ? { id: agency.marketing_os_tenant_id, slug: agency.marketing_os_tenant_id, source: 'travelbot_agency' }
      : null;

    const partnerTenants = await searchPartnerTenants(partnerApiBase, partnerApiKey, 'getouthouse');
    const partnerTenant =
      partnerTenants.find((item) => String(item.slug || '').toLowerCase().includes('getouthouse'))
      || partnerTenants[0]
      || null;

    if (partnerTenant?.id) {
      tenant = {
        ...tenant,
        ...partnerTenant,
        source: 'partner_api',
      };
    }

    if (tenant?.id) {
      try {
        const tenantById = await mos.query(
          `select id, slug, name, created_at, updated_at from tenants where id = $1 limit 1`,
          [tenant.id]
        );
        tenant = tenantById.rows[0] || tenant;
      } catch (_) {
        // Some production snapshots keep tenant metadata outside Postgres.
      }
    }

    const configRes = tenant?.id
      ? await mos.query(
          `select *
             from whatsapp_business_configs
            where tenant_id = $1
            order by updated_at desc nulls last, created_at desc nulls last
            limit 1`,
          [tenant.id]
        )
      : { rows: [] };

    const config = configRes.rows[0] || null;

    let recentConversationErrors = { rows: [] };
    if (tenant?.id) {
      try {
        recentConversationErrors = await mos.query(
          `select id, conversation_id, direction, message_type, status, provider_message_id,
                  recipient_phone, error_code, error_message, created_at
             from whatsapp_messages
            where tenant_id = $1
              and (status = 'FAILED' or error_code is not null or error_message is not null)
            order by created_at desc
            limit 10`,
          [tenant.id]
        );
      } catch (_) {
        recentConversationErrors = { rows: [] };
      }
    }

    const recentTbMessages = await tb.query(
      `select id, customer_id, agency_id, direction, type, status, content, "timestamp"
         from messages
        where agency_id = $1
          and status = 'FAILED'
        order by "timestamp" desc
        limit 10`,
      [agency.id]
    );

    let graphPhone = null;
    let graphWaba = null;
    let debugToken = null;
    if (config?.access_token && config?.phone_number_id) {
      graphPhone = await graphGet(
        apiVersion,
        config.phone_number_id,
        config.access_token,
        [
          'id',
          'display_phone_number',
          'verified_name',
          'quality_rating',
          'code_verification_status',
          'name_status',
          'new_name_status',
          'platform_type',
          'throughput',
        ].join(',')
      );
      debugToken = await graphDebugToken(apiVersion, metaAppId, metaAppSecret, config.access_token);
    }

    if (config?.access_token && config?.waba_id) {
      graphWaba = await graphGet(
        apiVersion,
        config.waba_id,
        config.access_token,
        [
          'id',
          'name',
          'account_review_status',
          'ownership_type',
          'message_template_namespace',
        ].join(',')
      );
    }

    const report = {
      agency,
      channels: channelsRes.rows,
      tenant,
      partnerTenantCandidates: partnerTenants,
      partnerApiBase,
      whatsappBusinessConfig: redactConfig(config),
      recentMarketingOsFailures: recentConversationErrors.rows,
      recentTravelBotFailures: recentTbMessages.rows,
      graph: {
        apiVersion,
        phoneNumber: graphPhone,
        businessAccount: graphWaba,
        tokenDebug: debugToken
          ? {
              ok: debugToken.ok,
              status: debugToken.status,
              data: debugToken.data?.data
                ? {
                    app_id: debugToken.data.data.app_id,
                    type: debugToken.data.data.type,
                    application: debugToken.data.data.application,
                    data_access_expires_at: debugToken.data.data.data_access_expires_at,
                    expires_at: debugToken.data.data.expires_at,
                    is_valid: debugToken.data.data.is_valid,
                    scopes: debugToken.data.data.scopes,
                  }
                : debugToken.data,
            }
          : null,
      },
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await Promise.allSettled([tb.end(), mos.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
