// Inline ChannelAdapter interface (stub - original file was deleted during migration)
export interface ChannelAdapter {
    sendMessage(...args: any[]): Promise<any>;
    sendTemplate?(...args: any[]): Promise<any>;
}

import { ConversationContext } from './models/whatsapp/ConversationContext.js';
import { IWhatsAppProvider } from './interfaces/whatsapp/index.js';

export function createWhatsAppAdapter(provider: IWhatsAppProvider) {
    async function sendMessage(
        context: ConversationContext,
        content: string,
        metadata?: Record<string, unknown>
    ): Promise<string> {
        const result = await provider.sendMessage({
            recipientPhone: context.externalId,
            messageType: 'TEXT',
            textContent: { body: content },
        });
        if (!result.success) {
            throw new Error(result.errorMessage || 'Failed to send WhatsApp message');
        }
        return result.providerMessageId!;
    }

    async function sendTemplate(
        context: ConversationContext,
        templateName: string,
        languageCode: string,
        variables: Record<string, string>
    ): Promise<string> {
        const components = Object.entries(variables).map(([key, value]) => ({
            type: 'body' as const,
            parameters: [{ type: 'text' as const, value }],
        }));
        const result = await provider.sendTemplate(
            context.externalId, templateName, languageCode, components
        );
        if (!result.success) {
            throw new Error(result.errorMessage || 'Failed to send WhatsApp template');
        }
        return result.providerMessageId!;
    }

    async function sendMedia(
        context: ConversationContext,
        url: string,
        caption?: string,
        mediaType: 'image' | 'document' | 'video' | 'audio' = 'image',
        fileName?: string
    ): Promise<string> {
        const result = await provider.sendMessage({
            recipientPhone: context.externalId,
            messageType: mediaType.toUpperCase() as any,
            mediaContent: {
                mediaId: 'url-reference',
                downloadUrl: url,
                caption,
                mimeType: mediaType === 'document' ? 'application/pdf' : 'application/octet-stream',
                fileName
            }
        });
        if (!result.success) {
            throw new Error(result.errorMessage || 'Failed to send WhatsApp media');
        }
        return result.providerMessageId!;
    }

    async function sendInteractive(
        context: ConversationContext,
        content: {
            type: 'button' | 'list' | 'product' | 'product_list' | 'catalog_message';
            body: string;
            header?: string | { type: 'text' | 'image' | 'video' | 'document'; text?: string; imageUrl?: string; mediaUrl?: string };
            footer?: string;
            action: {
                buttons?: Array<{ id: string; title: string }>;
                sections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
                catalog_id?: string;
                product_retailer_id?: string;
                thumbnail_product_retailer_id?: string;
            };
        }
    ): Promise<string> {
        // Build interactiveContent in the flat format that buildInteractivePayload expects:
        // body/footer/header as strings, buttons/sections at top level
        const interactiveContent: any = {
            type: content.type.toUpperCase(),
            body: content.body,
            header: content.header || undefined,
            footer: content.footer || undefined,
            // Lift buttons/sections to top level for BUTTON/LIST types
            // Support both content.buttons (direct) and content.action.buttons (nested)
            buttons: (content as any).buttons || content.action?.buttons,
            sections: (content as any).sections || content.action?.sections,
            // Keep action for PRODUCT/PRODUCT_LIST/CATALOG_MESSAGE types
            action: content.action,
        };

        let result;
        if ('sendInteractive' in provider) {
            result = await (provider as any).sendInteractive({
                type: 'interactive',
                recipientPhone: context.externalId,
                interactiveContent,
            });
        } else {
            result = await provider.sendMessage({
                recipientPhone: context.externalId,
                messageType: 'INTERACTIVE',
                interactiveContent,
            } as any);
        }

        if (!result.success) {
            throw new Error(result.errorMessage || 'Failed to send WhatsApp interactive message');
        }
        return result.providerMessageId!;
    }

    async function sendInteractiveProductMessage(
        context: ConversationContext,
        catalogId: string,
        productRetailerId: string,
        bodyText: string = 'Check out this product',
        footerText?: string
    ): Promise<string> {
        return sendInteractive(context, {
            type: 'product',
            body: bodyText,
            footer: footerText,
            action: {
                catalog_id: catalogId,
                product_retailer_id: productRetailerId,
            }
        });
    }

    async function sendInteractiveCatalogMessage(
        context: ConversationContext,
        bodyText: string = 'Browse our catalog!',
        footerText?: string,
        thumbnailProductRetailerId?: string
    ): Promise<string> {
        return sendInteractive(context, {
            type: 'catalog_message',
            body: bodyText,
            footer: footerText,
            action: {
                ...(thumbnailProductRetailerId
                    ? { thumbnail_product_retailer_id: thumbnailProductRetailerId }
                    : {}),
            }
        });
    }

    async function sendInteractiveMultiProductMessage(
        context: ConversationContext,
        catalogId: string,
        headerText: string,
        bodyText: string,
        sections: Array<{ title: string; product_items: Array<{ product_retailer_id: string }> }>,
        footerText?: string
    ): Promise<string> {
        const interactiveMessage: any = {
            type: 'interactive',
            recipientPhone: context.externalId,
            interactiveContent: {
                type: 'PRODUCT_LIST',
                header: headerText,
                body: bodyText,
                footer: footerText,
                action: {
                    catalog_id: catalogId,
                    sections,
                },
            }
        };

        let result;
        if ('sendInteractive' in provider) {
            result = await (provider as any).sendInteractive(interactiveMessage);
        } else {
            result = await provider.sendMessage({
                recipientPhone: context.externalId,
                messageType: 'INTERACTIVE' as any,
                interactiveContent: interactiveMessage.interactiveContent,
            } as any);
        }

        if (!result.success) {
            throw new Error(result.errorMessage || 'Failed to send WhatsApp multi-product message');
        }
        return result.providerMessageId!;
    }

    async function markAsRead(context: ConversationContext, messageId: string): Promise<void> {
        await provider.markAsRead(messageId);
    }

    async function sendTypingIndicator(context: ConversationContext, messageId: string): Promise<void> {
        if (typeof (provider as any).sendTypingIndicator === 'function') {
            await (provider as any).sendTypingIndicator(messageId);
            return;
        }
        await provider.markAsRead(messageId);
    }

    return { sendMessage, sendTemplate, sendMedia, sendInteractive, sendInteractiveProductMessage, sendInteractiveCatalogMessage, sendInteractiveMultiProductMessage, markAsRead, sendTypingIndicator };
}
