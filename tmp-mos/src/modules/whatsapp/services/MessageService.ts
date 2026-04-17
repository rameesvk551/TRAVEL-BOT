// application/services/whatsapp/MessageService.ts
// Core message handling - inbound/outbound with real-time socket events

import { WhatsAppMessage } from '../models/index.js';

/** Callback signature for pushing real-time events via sockets */
export type EmitEventFn = (tenantId: string, conversationId: string, event: string, data: any) => void;

/** No-op emitter used when sockets are not wired yet */
const noopEmit: EmitEventFn = () => { };

/** UUID v4 pattern */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Convert non-UUID user IDs to undefined for database compatibility. Only valid UUIDs are allowed. */
const sanitizeUserId = (userId?: string): string | undefined =>
    userId && UUID_PATTERN.test(userId) ? userId : undefined;

export function createMessageService(
    messageRepo: any, channelFactory: any, conversationService: any, timelineService: any,
    emitEvent: EmitEventFn = noopEmit,
) {

    function getSuggestedActions(context: any, message: any) {
        const actions: string[] = [];
        if (!context.hasLinkedEntity) actions.push('CREATE_LEAD');
        if (context.primaryEntity?.type === 'LEAD') actions.push('VIEW_LEAD', 'SEND_QUOTE', 'CREATE_BOOKING');
        if (context.primaryEntity?.type === 'BOOKING') actions.push('VIEW_BOOKING', 'SEND_PAYMENT_LINK', 'SEND_REMINDER');
        return actions;
    }

    function requiresHuman(message: any) {
        const text = message.textBody.toLowerCase();
        const urgentKeywords = ['urgent', 'emergency', 'refund', 'cancel', 'complaint', 'help'];
        return urgentKeywords.some((kw: string) => text.includes(kw));
    }

    async function processInbound(dto: any) {
        const existing = await messageRepo.findByProviderMessageId(dto.providerMessageId, dto.tenantId);
        if (existing) {
            return { messageId: existing.id, conversationId: existing.conversationId, isNewConversation: false, suggestedActions: [], requiresHumanReview: false };
        }
        const context = await conversationService.getOrCreateContext(dto.tenantId, dto.channel ?? 'WHATSAPP', dto.senderPhone, 'CUSTOMER');
        const isNewConversation = context.messageCount === 0;
        const message = WhatsAppMessage.create({
            tenantId: dto.tenantId, conversationId: context.id, providerMessageId: dto.providerMessageId,
            providerTimestamp: dto.providerTimestamp, direction: 'INBOUND', senderPhone: dto.senderPhone,
            recipientPhone: dto.recipientPhone, messageType: dto.messageType,
            textContent: dto.textBody ? { body: dto.textBody } : undefined,
            mediaContent: dto.mediaUrl ? { mediaId: dto.providerMessageId, mimeType: 'unknown', downloadUrl: dto.mediaUrl, caption: dto.mediaCaption } : undefined,
            locationContent: dto.locationLat ? { latitude: dto.locationLat, longitude: dto.locationLng } : undefined,
            orderContent: dto.orderContent,
            selectedButtonId: dto.selectedButtonId, selectedListItemId: dto.selectedListItemId,
            replyToMessageId: dto.replyToMessageId, status: 'DELIVERED',
            statusTimestamps: { delivered: new Date() }, isProcessed: false, requiresResponse: true,
            idempotencyKey: `${dto.providerMessageId}-${dto.tenantId}`,
        });
        const saved = await messageRepo.save(message);
        await conversationService.recordActivity(context.id, dto.tenantId);
        await timelineService.recordWhatsAppMessage(saved, context, 'INBOUND');
        try { const adapter = channelFactory.getAdapter(context.channel, dto.tenantId); await adapter.markAsRead(context, dto.providerMessageId); } catch (e) { console.warn('Failed to mark as read:', e); }
        const suggestedActions = getSuggestedActions(context, message);
        const requiresHumanReview = requiresHuman(message);

        // ── Real-time: push inbound message to connected clients ──
        emitEvent(dto.tenantId, context.id, 'whatsapp:message', {
            id: saved.id,
            conversationId: context.id,
            direction: 'INBOUND',
            type: dto.messageType,
            content: { body: dto.textBody, order: dto.orderContent },
            senderPhone: dto.senderPhone,
            timestamp: new Date().toISOString(),
            status: 'DELIVERED',
        });

        // ── Real-time: notify conversation list update ──
        emitEvent(dto.tenantId, context.id, 'whatsapp:conversation_updated', {
            conversationId: context.id,
            lastMessagePreview: dto.textBody?.slice(0, 80),
            lastMessageAt: new Date().toISOString(),
            isNewConversation,
        });

        return {
            messageId: saved.id, conversationId: context.id, isNewConversation,
            linkedTo: context.primaryEntity ? { type: context.primaryEntity.type, entityId: context.primaryEntity.entityId } : undefined,
            suggestedActions, requiresHumanReview,
        };
    }

    async function getMessagesByConversation(conversationId: string, tenantId: string, params?: any) {
        return messageRepo.findByConversation(conversationId, tenantId, params);
    }

    async function sendTypingIndicator(dto: any) {
        try {
            const context = await conversationService.getOrCreateContext(dto.tenantId, dto.channel ?? 'WHATSAPP', dto.recipientPhone, 'SALES_AGENT');
            const adapter = channelFactory.getAdapter(context.channel, dto.tenantId);
            await adapter.markAsRead(context, dto.providerMessageId);
            if (typeof adapter.sendTypingIndicator === 'function') {
                await adapter.sendTypingIndicator(context, dto.providerMessageId);
            }
            return { success: true };
        } catch (error: any) {
            console.error('[MessageService] sendTypingIndicator failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async function sendText(dto: any) {
        try {
            const context = await conversationService.getOrCreateContext(dto.tenantId, dto.channel ?? 'WHATSAPP', dto.recipientPhone, 'SALES_AGENT');
            const adapter = channelFactory.getAdapter(context.channel, dto.tenantId);
            const providerMessageId = await adapter.sendMessage(context, dto.text, { replyToMessageId: dto.replyToMessageId });
            const message = WhatsAppMessage.create({
                tenantId: dto.tenantId, conversationId: context.id, providerMessageId, providerTimestamp: new Date(),
                direction: 'OUTBOUND', senderPhone: dto.recipientPhone, recipientPhone: dto.recipientPhone,
                messageType: 'TEXT', textContent: { body: dto.text }, status: 'SENT',
                statusTimestamps: { sent: new Date() }, handledByUserId: sanitizeUserId(dto.senderUserId),
                isProcessed: true, requiresResponse: false, idempotencyKey: `${providerMessageId}-${dto.tenantId}`,
            });
            const saved = await messageRepo.save(message);
            if (dto.linkTo) await conversationService.linkToEntity(context.id, dto.tenantId, dto.linkTo.type, dto.linkTo.entityId);
            await timelineService.recordWhatsAppMessage(saved, context, 'OUTBOUND');

            // ── Real-time: push outbound message to all connected agents ──
            emitEvent(dto.tenantId, context.id, 'whatsapp:message', {
                id: saved.id,
                conversationId: context.id,
                direction: 'OUTBOUND',
                type: 'TEXT',
                content: { body: dto.text },
                recipientPhone: dto.recipientPhone,
                timestamp: new Date().toISOString(),
                status: 'SENT',
            });

            emitEvent(dto.tenantId, context.id, 'whatsapp:conversation_updated', {
                conversationId: context.id,
                lastMessagePreview: dto.text?.slice(0, 80),
                lastMessageAt: new Date().toISOString(),
            });

            return { success: true, messageId: saved.id, providerMessageId };
        } catch (error: any) {
            console.error('[MessageService] sendText failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async function sendTemplate(dto: any) {
        try {
            const context = await conversationService.getOrCreateContext(dto.tenantId, dto.channel ?? 'WHATSAPP', dto.recipientPhone, 'SALES_AGENT');
            const adapter = channelFactory.getAdapter(context.channel, dto.tenantId);
            const providerMessageId = await adapter.sendTemplate(context, dto.templateName, dto.language || 'en', dto.variables);
            const message = WhatsAppMessage.create({
                tenantId: dto.tenantId, conversationId: context.id, providerMessageId, providerTimestamp: new Date(),
                direction: 'OUTBOUND', senderPhone: dto.recipientPhone, recipientPhone: dto.recipientPhone,
                messageType: 'TEMPLATE', templateContent: { templateName: dto.templateName, language: dto.language || 'en', components: [] },
                status: 'SENT', statusTimestamps: { sent: new Date() }, handledByUserId: sanitizeUserId(dto.senderUserId),
                isProcessed: true, requiresResponse: false, idempotencyKey: `${providerMessageId}-${dto.tenantId}`,
            });
            const saved = await messageRepo.save(message);

            // ── Real-time: push template message to all connected agents ──
            emitEvent(dto.tenantId, context.id, 'whatsapp:message', {
                id: saved.id,
                conversationId: context.id,
                direction: 'OUTBOUND',
                type: 'TEMPLATE',
                content: { body: `📋 Template: ${dto.templateName}` },
                metadata: { templateName: dto.templateName },
                recipientPhone: dto.recipientPhone,
                timestamp: new Date().toISOString(),
                status: 'SENT',
            });

            emitEvent(dto.tenantId, context.id, 'whatsapp:conversation_updated', {
                conversationId: context.id,
                lastMessagePreview: `📋 Template: ${dto.templateName}`,
                lastMessageAt: new Date().toISOString(),
            });

            return { success: true, messageId: saved.id, providerMessageId };
        } catch (error: any) {
            console.error('[MessageService] sendTemplate failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async function sendMedia(dto: any) {
        try {
            const context = await conversationService.getOrCreateContext(dto.tenantId, dto.channel ?? 'WHATSAPP', dto.recipientPhone, 'SALES_AGENT');
            const adapter = channelFactory.getAdapter(context.channel, dto.tenantId);
            const providerMessageId = await adapter.sendMedia(
                context,
                dto.mediaUrl,
                dto.caption,
                dto.mediaType || 'image'
            );
            const message = WhatsAppMessage.create({
                tenantId: dto.tenantId,
                conversationId: context.id,
                providerMessageId,
                providerTimestamp: new Date(),
                direction: 'OUTBOUND',
                senderPhone: dto.recipientPhone,
                recipientPhone: dto.recipientPhone,
                messageType: String(dto.mediaType || 'IMAGE').toUpperCase() as any,
                mediaContent: {
                    mediaId: providerMessageId,
                    mimeType: dto.mimeType || 'image/jpeg',
                    caption: dto.caption,
                    downloadUrl: dto.mediaUrl,
                },
                status: 'SENT',
                statusTimestamps: { sent: new Date() },
                handledByUserId: sanitizeUserId(dto.senderUserId),
                isProcessed: true,
                requiresResponse: false,
                idempotencyKey: `${providerMessageId}-${dto.tenantId}`,
            });
            const saved = await messageRepo.save(message);
            await timelineService.recordWhatsAppMessage(saved, context, 'OUTBOUND');

            emitEvent(dto.tenantId, context.id, 'whatsapp:message', {
                id: saved.id,
                conversationId: context.id,
                direction: 'OUTBOUND',
                type: String(dto.mediaType || 'IMAGE').toUpperCase(),
                content: {
                    caption: dto.caption,
                    mediaUrl: dto.mediaUrl,
                },
                recipientPhone: dto.recipientPhone,
                timestamp: new Date().toISOString(),
                status: 'SENT',
            });

            emitEvent(dto.tenantId, context.id, 'whatsapp:conversation_updated', {
                conversationId: context.id,
                lastMessagePreview: dto.caption || 'Sent an image',
                lastMessageAt: new Date().toISOString(),
            });

            return { success: true, messageId: saved.id, providerMessageId };
        } catch (error: any) {
            console.error('[MessageService] sendMedia failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async function sendInteractive(dto: any) {
        try {
            // Normalize: AIEcommerceAssistant sends { bodyText, buttons } instead of { interactiveContent }
            if (!dto.interactiveContent && dto.bodyText) {
                dto.interactiveContent = {
                    type: 'BUTTON',
                    body: dto.bodyText,
                    footer: dto.footerText,
                    buttons: (dto.buttons || []).map((b: any) => ({ 
                        id: b.id, 
                        title: (b.title || 'Select').trim() || 'Select' 
                    })),
                };
            }

            const context = await conversationService.getOrCreateContext(dto.tenantId, dto.channel ?? 'WHATSAPP', dto.recipientPhone, 'SALES_AGENT');
            const adapter = channelFactory.getAdapter(context.channel, dto.tenantId);

            let providerMessageId: string;
            if (!dto.interactiveContent) {
                throw new Error('sendInteractive: missing interactiveContent and bodyText');
            }
            if (dto.interactiveContent.type === 'CATALOG_MESSAGE') {
                providerMessageId = await adapter.sendInteractiveCatalogMessage(
                    context,
                    dto.interactiveContent.body || 'Check out our products!',
                    dto.interactiveContent.footer,
                    dto.interactiveContent.action?.thumbnail_product_retailer_id
                );
            } else if (dto.interactiveContent.type === 'PRODUCT') {
                providerMessageId = await adapter.sendInteractiveProductMessage(
                    context,
                    dto.interactiveContent.action?.catalog_id || '',
                    dto.interactiveContent.action?.product_retailer_id || '',
                    dto.interactiveContent.body || 'Product Details'
                );
            } else if (dto.interactiveContent.type === 'PRODUCT_LIST') {
                providerMessageId = await adapter.sendInteractiveMultiProductMessage(
                    context,
                    dto.interactiveContent.action?.catalog_id || '',
                    dto.interactiveContent.header || 'Products',
                    dto.interactiveContent.body || 'Browse our products',
                    dto.interactiveContent.action?.sections || [],
                    dto.interactiveContent.footer
                );
            } else {
                // fallback generic interactive send
                providerMessageId = await adapter.sendInteractive(context, dto.interactiveContent);
            }

            const message = WhatsAppMessage.create({
                tenantId: dto.tenantId, conversationId: context.id, providerMessageId, providerTimestamp: new Date(),
                direction: 'OUTBOUND', senderPhone: dto.recipientPhone, recipientPhone: dto.recipientPhone,
                messageType: 'INTERACTIVE', interactiveContent: dto.interactiveContent, status: 'SENT',
                statusTimestamps: { sent: new Date() }, handledByUserId: sanitizeUserId(dto.senderUserId),
                isProcessed: true, requiresResponse: false, idempotencyKey: `${providerMessageId}-${dto.tenantId}`,
            });

            const saved = await messageRepo.save(message);
            if (dto.linkTo) await conversationService.linkToEntity(context.id, dto.tenantId, dto.linkTo.type, dto.linkTo.entityId);
            await timelineService.recordWhatsAppMessage(saved, context, 'OUTBOUND');

            // ── Real-time: push outbound message to all connected agents ──
            emitEvent(dto.tenantId, context.id, 'whatsapp:message', {
                id: saved.id,
                conversationId: context.id,
                direction: 'OUTBOUND',
                type: 'INTERACTIVE',
                content: dto.interactiveContent,
                recipientPhone: dto.recipientPhone,
                timestamp: new Date().toISOString(),
                status: 'SENT',
            });

            emitEvent(dto.tenantId, context.id, 'whatsapp:conversation_updated', {
                conversationId: context.id,
                lastMessagePreview: dto.interactiveContent.type === 'CATALOG_MESSAGE' ? 'Sent a catalog' : 'Sent a product',
                lastMessageAt: new Date().toISOString(),
            });

            return { success: true, messageId: saved.id, providerMessageId };
        } catch (error: any) {
            console.error('[MessageService] sendInteractive failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async function generatePaymentLink(conversationId: string, messageId: string, tenantId: string, userId: string) {
        const messages = await messageRepo.findByConversation(conversationId, tenantId);
        const orderMsg = messages.find((m: any) => m.id === messageId);
        if (!orderMsg || (orderMsg.messageType !== 'ORDER' && orderMsg.type !== 'ORDER')) {
            return { success: false, error: 'Order message not found' };
        }

        const order = orderMsg.orderContent || orderMsg.content?.order;
        if (!order || !order.product_items || order.product_items.length === 0) {
            return { success: false, error: 'Order has no items' };
        }

        try {
            const Stripe = (await import('stripe')).default;
            const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_123';
            const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any });

            const lineItems = order.product_items.map((item: any) => {
                const unitAmount = Math.round(parseFloat(item.item_price) * 100);
                return {
                    price_data: {
                        currency: item.currency || 'usd',
                        product_data: {
                            name: `Product ${item.product_retailer_id}`,
                            description: `Catalog: ${order.catalog_id}`,
                        },
                        unit_amount: unitAmount,
                    },
                    quantity: item.quantity || 1,
                };
            });

            // For simplicity, we create a Checkout Session instead of a Payment Link 
            // since PaymentLinks require pre-created products on Stripe. 
            // Checkout sessions allow ad-hoc inline price/product definitions.
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: 'payment',
                success_url: 'https://your-app.com/success',
                cancel_url: 'https://your-app.com/cancel',
            });

            const paymentLink = session.url;

            // Automatically send the link as a text message back to the customer
            await sendText({
                tenantId,
                recipientPhone: orderMsg.senderPhone, // Since it was inbound, senderPhone is customer
                text: `Here is the payment link for your order:\n👉 ${paymentLink}`,
                senderUserId: userId,
                channel: 'WHATSAPP'
            });

            return { success: true, paymentLink };
        } catch (error: any) {
            console.error('Stripe error:', error);
            // In dev environment, if Stripe isn't configured, we just send a mock link
            if (error.message.includes('Invalid API Key') || !process.env.STRIPE_SECRET_KEY) {
                console.warn('Stripe not configured, falling back to mock link');
                const mockLink = 'https://buy.stripe.com/mock_dummy_link_for_dev';
                await sendText({
                    tenantId,
                    recipientPhone: orderMsg.senderPhone,
                    text: `Here is the mock payment link for your order:\n👉 ${mockLink}`,
                    senderUserId: userId,
                    channel: 'WHATSAPP'
                });
                return { success: true, paymentLink: mockLink };
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle delivery-status webhooks from Meta (sent → delivered → read → failed).
     * Persists the new status and pushes a real-time 'whatsapp:status' event so the
     * UI can update tick marks instantly without polling.
     */
    async function handleStatusUpdate(update: any) {
        const status = update.status === 'sent' ? 'SENT'
            : update.status === 'delivered' ? 'DELIVERED'
                : update.status === 'read' ? 'READ'
                    : 'FAILED';

        // Find the message by its provider-side ID
        const existing = await messageRepo.findByProviderMessageId(
            update.providerMessageId,
            update.tenantId
        );
        if (!existing) return;

        // Persist to DB
        await messageRepo.updateStatus(
            existing.id,
            existing.tenantId,
            status,
            update.timestamp ? new Date(update.timestamp) : new Date(),
            update.errorCode
        );

        // ── Real-time: push status change so UI updates tick marks instantly ──
        emitEvent(existing.tenantId, existing.conversationId, 'whatsapp:status', {
            messageId: existing.id,
            conversationId: existing.conversationId,
            providerMessageId: update.providerMessageId,
            status,
            timestamp: new Date().toISOString(),
        });
    }

    return { processInbound, getMessagesByConversation, sendTypingIndicator, sendText, sendTemplate, sendMedia, sendInteractive, handleStatusUpdate, getSuggestedActions, requiresHuman, generatePaymentLink };
}
