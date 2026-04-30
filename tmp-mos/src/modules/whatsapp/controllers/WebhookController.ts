import * as partnerService from '../../partner/partner.service.js';
import { getPool } from '../../../config/database.js';
import { TenantModel } from '../../tenant/tenant.model.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Inline helper to resolve tenant ID from phone number ID or WABA ID
const resolveTenantId = async (id: string): Promise<string | null> => {
    try {
        const pool = getPool();
        const res = await pool.query(
            `SELECT tenant_id FROM whatsapp_business_configs 
             WHERE phone_number_id = $1 OR waba_id = $1 
             LIMIT 1`,
            [id]
        );
        return res.rows.length > 0 ? res.rows[0].tenant_id : null;
    } catch (err) {
        console.error('[Webhook] Failed to resolve tenant ID:', err);
        return null;
    }
};

const resolveSqlTenantId = async (tenantId: string | undefined | null): Promise<string | null> => {
    if (!tenantId) {
        return null;
    }

    if (UUID_PATTERN.test(tenantId)) {
        return tenantId;
    }

    try {
        const pool = getPool();

        const tenantLookup = await pool.query(
            'SELECT id FROM tenants WHERE slug = $1 LIMIT 1',
            [tenantId]
        );
        const sqlTenantId = tenantLookup.rows?.[0]?.id as string | undefined;
        if (sqlTenantId) {
            return sqlTenantId;
        }

        const mongoTenant = await TenantModel.findOne({
            $or: [
                { slug: tenantId },
                { 'metadata.sqlTenantId': tenantId },
            ],
        })
            .select('metadata email')
            .lean();

        const bridgedSqlTenantId = typeof mongoTenant?.metadata?.sqlTenantId === 'string'
            ? mongoTenant.metadata.sqlTenantId
            : undefined;
        if (bridgedSqlTenantId && UUID_PATTERN.test(bridgedSqlTenantId)) {
            return bridgedSqlTenantId;
        }

        if (mongoTenant?.email) {
            const userLookup = await pool.query(
                'SELECT tenant_id FROM users WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
                [mongoTenant.email]
            );
            const userTenantId = userLookup.rows?.[0]?.tenant_id as string | undefined;
            if (userTenantId) {
                return userTenantId;
            }
        }

        return null;
    } catch (err) {
        console.error('[Webhook] Failed to resolve SQL tenant ID:', err);
        return null;
    }
};

const getTenantWhatsAppGraphConfig = async (tenantId: string, fallbackPhoneNumberId?: string | null) => {
    const pool = getPool();
    const result = await pool.query(
        `SELECT phone_number_id, access_token
         FROM whatsapp_business_configs
         WHERE tenant_id = $1
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1`,
        [tenantId]
    );

    const row = result.rows?.[0];
    const phoneNumberId = fallbackPhoneNumberId || row?.phone_number_id;
    const accessToken = row?.access_token || process.env.META_ACCESS_TOKEN;

    if (!phoneNumberId) {
        throw new Error('WhatsApp phone number ID is required for Business App sync');
    }

    if (!accessToken) {
        throw new Error('Meta access token is required for Business App sync');
    }

    return { phoneNumberId, accessToken };
};

const requestSmbAppDataSync = async (params: {
    tenantId: string;
    phoneNumberId?: string | null;
    syncType: 'smb_app_state_sync' | 'history';
}) => {
    const { phoneNumberId, accessToken } = await getTenantWhatsAppGraphConfig(params.tenantId, params.phoneNumberId);
    const apiVersion = process.env.META_API_VERSION || process.env.WHATSAPP_API_VERSION || 'v25.0';
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/smb_app_data`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            sync_type: params.syncType,
        }),
    });

    const data = await response.json().catch(async () => ({
        message: await response.text(),
    }));

    if (!response.ok) {
        throw new Error((data as any)?.error?.message || (data as any)?.message || 'Meta Business App sync request failed');
    }

    return data;
};

export const createWebhookController = (
    provider: any,
    conversationService: any,
    messageService: any,
    workflowOrchestrator: any,
    flowEngine: any,
    waConfigRepo: any,
    auditLogRepo: any,
    aiEcommerceAssistant: any,
    automationEngine: any,
    orderService: any,
    whatsappCatalogService: any
) => {
    const audit = (tenantId: string, data: any) => auditLogRepo.create(tenantId, data);

    const verifyWebhook = (req: any, res: any) => {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            res.status(200).send(challenge);
        } else {
            res.status(403).send('Forbidden');
        }
    };

    const handleWebhook = async (req: any, res: any, next: any) => {
        try {
            const rawBody = req.body;
            console.log('[Webhook] Received WhatsApp Request Body:', JSON.stringify(rawBody, null, 2));

            const nestedValue = rawBody?.entry?.[0]?.changes?.[0]?.value;
            const isFlowRequest = Boolean(
                rawBody?.encrypted_flow_data || 
                rawBody?.action === 'ping' || 
                nestedValue?.encrypted_flow_data
            );
            const flowPayload = nestedValue?.encrypted_flow_data ? nestedValue : rawBody;

            // Verify Signature
            const payload = {
                provider: provider.providerType, eventType: 'MESSAGE_RECEIVED', timestamp: new Date(),
                rawBody: JSON.stringify(req.body), signature: req.headers['x-hub-signature-256'], headers: req.headers,
            };
            if (!provider.verifyWebhookSignature(payload)) { 
                console.error('[Webhook] Invalid signature'); 
                if (isFlowRequest && !res.headersSent) res.status(401).send('Invalid signature');
                return; 
            }

            // ── PARTNER RAW PROXY: Check for Partner Tenant ──
            try {
                let proxyTenantId = null;
                const value = rawBody?.entry?.[0]?.changes?.[0]?.value;
                const phoneNumberId = value?.metadata?.phone_number_id;
                const wabaId = rawBody?.entry?.[0]?.id || value?.waba_info?.waba_id;

                if (phoneNumberId) {
                    proxyTenantId = await resolveTenantId(phoneNumberId);
                } else if (wabaId) {
                    proxyTenantId = await resolveTenantId(wabaId);
                }

                // EMERGENCY FALLBACK FOR WAYO
                if (!proxyTenantId && (phoneNumberId === '919556244575947' || wabaId === '864633239519648')) {
                    console.log(`[Webhook] [EMERGENCY] Forcing Wayo proxy for ID: ${phoneNumberId || wabaId}`);
                    proxyTenantId = 'b78ba0d3-3563-441d-b657-619f79e2e58e';
                }

                // If found, proxy EVERYTHING for partner tenants RAW
                if (proxyTenantId) {
                    const partnerProxyResult = await partnerService.dispatchPartnerWebhookByTenant({
                        tenantId: proxyTenantId,
                        eventType: 'message', // Generic message type for proxy
                        data: isFlowRequest ? flowPayload : rawBody,
                        isRawProxy: true
                    });

                    if (partnerProxyResult?.isPartnerTenant) {
                        console.log(`[Webhook] Partner message identified for ${proxyTenantId}. Proxy dispatched: ${partnerProxyResult.dispatchedToWebhook}`);
                        if (!res.headersSent) {
                            res.status(200).send(partnerProxyResult.responseBody || 'OK');
                        }
                        return; // CRITICAL: Stop further processing for partner messages
                    }
                }
            } catch (proxyErr) {
                console.warn('[Webhook] Failed to process proxy logic:', proxyErr);
            }

            // Send 200 OK early for Standard Webhooks (prevent timeouts) only if NOT proxied
            if (!isFlowRequest && !res.headersSent) {
                res.status(200).send('OK');
            }

            if (isFlowRequest && !res.headersSent) {
                return res.status(404).send('Flow handler not found');
            }

            const message = provider.parseWebhookMessage(payload);
            if (message) {
                const tenantId = await resolveTenantId(message.recipientPhone);
                if (tenantId) {
                    await audit(tenantId, {
                        eventType: 'webhook_message_received', actorType: 'WEBHOOK', actorPhone: message.senderPhone,
                        payload: { providerMessageId: message.providerMessageId, messageType: message.messageType },
                    });
                    await messageService.processInbound({
                        tenantId, providerMessageId: message.providerMessageId, providerTimestamp: message.providerTimestamp,
                        senderPhone: message.senderPhone, recipientPhone: message.recipientPhone, messageType: message.messageType,
                        textBody: message.textContent?.body, mediaUrl: message.mediaContent?.downloadUrl, mediaCaption: message.mediaContent?.caption,
                    });
                }
            }
        } catch (error) { next(error); }
    };

    return { 
        verifyWebhook, 
        handleWebhook, 
        handleBusinessHours: async (req: any, res: any) => res.json({ success: true }),
        sendMessage: async (req: any, res: any) => {
            const { tenantId, to, body } = req.body;
            const effectiveTenantId = await resolveSqlTenantId(tenantId || req.context?.tenantId);
            if (!effectiveTenantId) {
                res.status(400).json({ success: false, error: 'Unable to resolve tenant for WhatsApp send' });
                return;
            }
            const result = await messageService.sendText({
                tenantId: effectiveTenantId,
                recipientPhone: to,
                text: body,
                senderUserId: 'PARTNER_API',
            });
            res.json(result);
        },
        sendMessageV2: async (req: any, res: any) => {
            const { tenantId, recipient, message } = req.body;
            const effectiveTenantId = await resolveSqlTenantId(tenantId || req.context?.tenantId);
            if (!effectiveTenantId) {
                res.status(400).json({ success: false, error: 'Unable to resolve tenant for WhatsApp send' });
                return;
            }
            const result = await messageService.sendText({
                tenantId: effectiveTenantId,
                recipientPhone: recipient,
                text: typeof message === 'string' ? message : (message?.text || message?.body || ''),
                senderUserId: 'PARTNER_API',
            });
            res.json(result);
        },
        sendTemplate: async (req: any, res: any) => {
            const { tenantId, to, templateName, language, components } = req.body;
            const effectiveTenantId = await resolveSqlTenantId(tenantId || req.context?.tenantId);
            if (!effectiveTenantId) {
                res.status(400).json({ success: false, error: 'Unable to resolve tenant for WhatsApp send' });
                return;
            }
            const result = await messageService.sendTemplate({
                tenantId: effectiveTenantId,
                recipientPhone: to,
                templateName,
                language: language || 'en',
                variables: components || {},
                senderUserId: 'PARTNER_API',
            });
            res.json(result);
        },
        sendInteractive: async (req: any, res: any) => {
            const { tenantId, recipientPhone, to, interactiveContent } = req.body;
            const effectiveTenantId = await resolveSqlTenantId(tenantId || req.context?.tenantId);
            if (!effectiveTenantId) {
                res.status(400).json({ success: false, error: 'Unable to resolve tenant for WhatsApp send' });
                return;
            }
            if (!interactiveContent) {
                res.status(400).json({ success: false, error: 'interactiveContent is required' });
                return;
            }
            const result = await messageService.sendInteractive({
                tenantId: effectiveTenantId,
                recipientPhone: recipientPhone || to,
                interactiveContent,
                senderUserId: 'PARTNER_API',
            });
            res.json(result);
        },
        sendMedia: async (req: any, res: any) => {
            const { tenantId, recipientPhone, to, mediaUrl, caption, mediaType, mimeType } = req.body;
            const effectiveTenantId = await resolveSqlTenantId(tenantId || req.context?.tenantId);
            if (!effectiveTenantId) {
                res.status(400).json({ success: false, error: 'Unable to resolve tenant for WhatsApp send' });
                return;
            }
            if (!mediaUrl) {
                res.status(400).json({ success: false, error: 'mediaUrl is required' });
                return;
            }
            const result = await messageService.sendMedia({
                tenantId: effectiveTenantId,
                recipientPhone: recipientPhone || to,
                mediaUrl,
                caption,
                mediaType: mediaType || 'image',
                mimeType,
                senderUserId: 'PARTNER_API',
            });
            res.json(result);
        },
        sendReadTyping: async (req: any, res: any) => {
            const { tenantId, recipientPhone, to, messageId, providerMessageId } = req.body;
            const effectiveTenantId = await resolveSqlTenantId(tenantId || req.context?.tenantId);
            if (!effectiveTenantId) {
                res.status(400).json({ success: false, error: 'Unable to resolve tenant for WhatsApp send' });
                return;
            }

            const targetPhone = recipientPhone || to;
            const targetMessageId = messageId || providerMessageId;

            if (!targetPhone) {
                res.status(400).json({ success: false, error: 'recipientPhone (or to) is required' });
                return;
            }

            if (!targetMessageId) {
                res.status(400).json({ success: false, error: 'messageId (or providerMessageId) is required' });
                return;
            }

            const result = await messageService.sendTypingIndicator({
                tenantId: effectiveTenantId,
                recipientPhone: targetPhone,
                providerMessageId: targetMessageId,
                senderUserId: 'PARTNER_API',
            });

            res.json(result);
        },
        triggerSmbAppDataSync: async (req: any, res: any) => {
            const syncType = req.body?.sync_type || req.body?.syncType;
            if (!['smb_app_state_sync', 'history'].includes(syncType)) {
                res.status(400).json({ success: false, error: 'sync_type must be smb_app_state_sync or history' });
                return;
            }

            const effectiveTenantId = await resolveSqlTenantId(req.body?.tenantId || req.context?.tenantId);
            if (!effectiveTenantId) {
                res.status(400).json({ success: false, error: 'Unable to resolve tenant for Business App sync' });
                return;
            }

            const data = await requestSmbAppDataSync({
                tenantId: effectiveTenantId,
                phoneNumberId: req.body?.phoneNumberId || req.body?.phone_number_id,
                syncType,
            });

            res.json({ success: true, data });
        },
        getMessageStatus: async (req: any, res: any) => {
            const { messageId } = req.params;
            const result = await messageService.getMessageStatus(messageId);
            res.json(result);
        }
    };
};
