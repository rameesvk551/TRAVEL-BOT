// Inline ChannelAdapter interface (stub - original file was deleted during migration)
export interface ChannelAdapter {
    sendMessage(...args: any[]): Promise<any>;
    sendTemplate?(...args: any[]): Promise<any>;
}

import { ConversationContext } from './models/whatsapp/ConversationContext.js';
import { IWhatsAppProvider } from './interfaces/whatsapp/index.js';

export function createWhatsAppAdapter(provider: IWhatsAppProvider) {
    function normalizeComponentType(component: any): string {
        return String(component?.type || '').toUpperCase();
    }

    function extractPlaceholderIndexes(textValue: string): number[] {
        const matches = String(textValue || '').match(/{{\s*\d+\s*}}/g) || [];
        return [...new Set(
            matches
                .map((token) => parseInt(token.replace(/[^\d]/g, ''), 10))
                .filter((value) => Number.isFinite(value))
                .sort((a, b) => a - b)
        )] as number[];
    }

    function buildTextParameters(textValue: string, variables: Record<string, string>): any[] {
        return extractPlaceholderIndexes(textValue)
            .map((index) => variables[String(index)])
            .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
            .map((value) => ({ type: 'text', value: String(value) }));
    }

    function buildHeaderParameters(component: any, variables: Record<string, string>): any[] {
        const format = String(component?.format || '').toUpperCase();
        if (format === 'TEXT') {
            return buildTextParameters(String(component?.text || ''), variables);
        }

        const handle = component?.example?.header_handle?.[0];
        if (!handle) return [];
        return [{ type: format.toLowerCase(), value: handle }];
    }

    function isSendReadyParameter(parameter: any): boolean {
        if (!parameter || typeof parameter !== 'object') return false;
        const type = String(parameter.type || '').toLowerCase();
        if (type === 'text') {
            return typeof parameter.text === 'string' || typeof parameter.value === 'string';
        }
        if (type === 'image' || type === 'video') {
            return Boolean(parameter?.[type]?.link || parameter?.value);
        }
        if (type === 'document') {
            return Boolean(parameter?.document?.link || parameter?.value);
        }
        return false;
    }

    function isSendReadyComponent(component: any): boolean {
        if (!component || typeof component !== 'object') return false;
        const type = String(component.type || '').toLowerCase();
        if (type === 'carousel') {
            return Array.isArray(component.cards)
                && component.cards.every((card: any) =>
                    Array.isArray(card?.components)
                    && card.components.every((cardComponent: any) =>
                        Array.isArray(cardComponent?.parameters)
                        && cardComponent.parameters.every(isSendReadyParameter)
                    )
                );
        }
        return Array.isArray(component.parameters) && component.parameters.every(isSendReadyParameter);
    }

    function buildComponentsFromTemplate(templateComponents: any[] | undefined, variables: Record<string, string>): any[] {
        if (!Array.isArray(templateComponents) || templateComponents.length === 0) return [];

        if (templateComponents.every(isSendReadyComponent)) {
            return templateComponents;
        }

        const components: any[] = [];
        const bodyComponent = templateComponents.find((component: any) => normalizeComponentType(component) === 'BODY');
        const carouselComponent = templateComponents.find((component: any) => normalizeComponentType(component) === 'CAROUSEL');

        if (bodyComponent) {
            const bodyParameters = buildTextParameters(String(bodyComponent?.text || ''), variables);
            if (bodyParameters.length > 0) {
                components.push({ type: 'body', parameters: bodyParameters });
            }
        }

        if (carouselComponent && Array.isArray(carouselComponent.cards)) {
            const cards = carouselComponent.cards
                .map((card: any, index: number) => {
                    const cardComponents: any[] = [];
                    for (const component of (card?.components || [])) {
                        const componentType = normalizeComponentType(component);
                        if (componentType === 'HEADER') {
                            const headerParameters = buildHeaderParameters(component, variables);
                            if (headerParameters.length > 0) {
                                cardComponents.push({ type: 'header', parameters: headerParameters });
                            }
                        }
                        if (componentType === 'BODY') {
                            const bodyParameters = buildTextParameters(String(component?.text || ''), variables);
                            if (bodyParameters.length > 0) {
                                cardComponents.push({ type: 'body', parameters: bodyParameters });
                            }
                        }
                    }

                    return cardComponents.length > 0
                        ? { cardIndex: index, components: cardComponents }
                        : null;
                })
                .filter(Boolean);

            if (cards.length > 0) {
                components.push({ type: 'carousel', cards });
            }
            return components;
        }

        const headerComponent = templateComponents.find((component: any) => normalizeComponentType(component) === 'HEADER');
        if (headerComponent) {
            const headerParameters = buildHeaderParameters(headerComponent, variables);
            if (headerParameters.length > 0) {
                components.unshift({ type: 'header', parameters: headerParameters });
            }
        }

        return components;
    }

    function buildFallbackComponents(templateName: string, variables: Record<string, string>): any[] {
        const components: any[] = [];
        const sortedKeys = Object.keys(variables).sort((a, b) => Number(a) - Number(b));
        const isMediaTemplate = /image|media|video|doc/i.test(templateName);
        const firstVar = variables[sortedKeys[0]];
        const isFirstVarUrl = firstVar && /^https?:\/\//i.test(firstVar);
        let bodyVars = sortedKeys;

        if (isMediaTemplate && isFirstVarUrl) {
            const headerVar = sortedKeys[0];
            bodyVars = sortedKeys.slice(1);
            components.push({
                type: 'header',
                parameters: [{ type: 'image', value: variables[headerVar] }],
            });
        }

        if (bodyVars.length > 0) {
            components.push({
                type: 'body',
                parameters: bodyVars.map((key) => ({
                    type: /^https?:\/\//i.test(variables[key]) ? 'image' : 'text',
                    value: variables[key],
                })),
            });
        }

        return components;
    }

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
        variables: Record<string, string>,
        templateComponents?: any[]
    ): Promise<string> {
        console.log(`[WhatsAppAdapter] sendTemplate: ${templateName} (${languageCode})`, JSON.stringify(variables));

        const componentsFromTemplate = buildComponentsFromTemplate(templateComponents, variables);
        const components = componentsFromTemplate.length > 0
            ? componentsFromTemplate
            : buildFallbackComponents(templateName, variables);

        console.log('[WhatsAppAdapter] Constructed components:', JSON.stringify(components));

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
        mediaType: 'image' | 'document' | 'video' | 'audio' = 'image'
    ): Promise<string> {
        const result = await provider.sendMessage({
            recipientPhone: context.externalId,
            messageType: mediaType.toUpperCase() as any,
            mediaContent: {
                mediaId: 'url-reference',
                downloadUrl: url,
                caption,
                mimeType: 'application/octet-stream'
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
        const interactiveContent: any = {
            type: content.type.toUpperCase(),
            body: content.body,
            header: content.header || undefined,
            footer: content.footer || undefined,
            buttons: (content as any).buttons || content.action?.buttons,
            sections: (content as any).sections || content.action?.sections,
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

    return { sendMessage, sendTemplate, sendMedia, sendInteractive, sendInteractiveProductMessage, sendInteractiveCatalogMessage, sendInteractiveMultiProductMessage, markAsRead };
}
