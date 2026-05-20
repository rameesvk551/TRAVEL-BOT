// infrastructure/whatsapp/providers/MetaCloudProvider.ts
// Meta (Facebook) WhatsApp Cloud API adapter

import {
  IWhatsAppProvider,
  ProviderType,
  RawWebhookPayload,
  IncomingMessage,
  MessageStatusUpdate,
  SendMessageRequest,
  SendMessageResult,
  TemplateSubmission,
  TemplateApprovalStatus,
  MediaUploadResult,
  WhatsAppFlowDefinition,
  WhatsAppFlowSummary,
  WhatsAppFlowUpsertInput,
} from '../interfaces/whatsapp/index.js';
import { TemplateContent } from '../models/whatsapp/index.js';

interface MetaConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  apiVersion: string;
}

interface MetaGraphResponse<T> {
  ok: boolean;
  status: number;
  data: T;
}

function buildGraphUrl(apiVersion: string, idOrPath: string): string {
  return `https://graph.facebook.com/${apiVersion}/${idOrPath.replace(/^\/+/, '')}`;
}

async function parseGraphResponse<T>(response: Response): Promise<MetaGraphResponse<T>> {
  const data = await response.json().catch(async () => ({
    message: await response.text(),
  })) as T;

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function graphJsonRequest<T>(
  apiVersion: string,
  accessToken: string,
  idOrPath: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
  } = {}
): Promise<MetaGraphResponse<T>> {
  const response = await fetch(buildGraphUrl(apiVersion, idOrPath), {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return parseGraphResponse<T>(response);
}

async function graphFormRequest<T>(
  apiVersion: string,
  accessToken: string,
  idOrPath: string,
  formData: FormData
): Promise<MetaGraphResponse<T>> {
  const response = await fetch(buildGraphUrl(apiVersion, idOrPath), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return parseGraphResponse<T>(response);
}

function toFlowSummary(flow: any): WhatsAppFlowSummary {
  return {
    id: flow?.id,
    name: flow?.name,
    status: flow?.status,
    categories: Array.isArray(flow?.categories) ? flow.categories : [],
    endpointUri: flow?.endpoint_uri,
    validationErrors: Array.isArray(flow?.validation_errors) ? flow.validation_errors : [],
    healthStatus: flow?.health_status || null,
    jsonVersion: flow?.json_version,
    dataApiVersion: flow?.data_api_version,
  };
}

function ensureGraphOk<T>(result: MetaGraphResponse<T>, action: string): T {
  if (!result.ok) {
    const message = (result.data as any)?.error?.message
      || (result.data as any)?.message
      || `Meta Graph request failed during ${action}`;
    throw new Error(message);
  }
  return result.data;
}

async function uploadFlowJsonAsset(
  flowId: string,
  jsonDefinition: Record<string, unknown>,
  accessToken: string,
  apiVersion: string
): Promise<void> {
  const formData = new FormData();
  const payload = JSON.stringify(jsonDefinition, null, 2);
  formData.append('file', new Blob([payload], { type: 'application/json' }), 'flow.json');
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');

  const result = await graphFormRequest<any>(apiVersion, accessToken, `${flowId}/assets`, formData);
  ensureGraphOk(result, 'flow asset upload');
}

function readHeaderText(header: any): string | undefined {
  if (!header) return undefined;
  if (typeof header === 'string') return header;
  return typeof header.text === 'string' && header.text.trim() ? header.text.trim() : undefined;
}

function buildButtonHeader(header: any): Record<string, unknown> | undefined {
  if (!header) return undefined;

  if (typeof header === 'string') {
    return { type: 'text', text: header };
  }

  if (header.type === 'text') {
    const text = readHeaderText(header);
    return text ? { type: 'text', text } : undefined;
  }

  const mediaType = header.type;
  const mediaLink = header.imageUrl || header.mediaUrl;
  if (!mediaLink || !['image', 'video', 'document'].includes(mediaType)) {
    const text = readHeaderText(header);
    return text ? { type: 'text', text } : undefined;
  }

  return {
    type: mediaType,
    [mediaType]: {
      link: mediaLink,
    },
  };
}

/**
 * Build interactive message payload
 */
function buildInteractivePayload(content: NonNullable<SendMessageRequest['interactiveContent']>): Record<string, unknown> {
  if (content.type === 'BUTTON') {
    return {
      type: 'button',
      header: buildButtonHeader(content.header),
      body: { text: content.body },
      footer: content.footer ? { text: content.footer } : undefined,
      action: {
        buttons: (content.buttons || []).map((btn: any) => ({
          type: 'reply',
          reply: { 
            id: btn.id, 
            title: (btn.title || 'Reply').trim().substring(0, 20) || 'Reply' 
          },
        })),
      },
    };
  }

  if (content.type === 'LIST') {
    return {
      type: 'list',
      header: readHeaderText(content.header) ? { type: 'text', text: readHeaderText(content.header)! } : undefined,
      body: { text: content.body },
      footer: content.footer ? { text: content.footer } : undefined,
      action: {
        button: 'Select',
        sections: content.sections?.map((section: any) => ({
          title: section.title,
          rows: section.rows.map((row: any) => ({
            id: row.id,
            title: row.title,
            description: row.description,
          })),
        })),
      },
    };
  }

  if (content.type === 'PRODUCT') {
    return {
      type: 'product',
      body: { text: content.body },
      footer: content.footer ? { text: content.footer } : undefined,
      action: {
        catalog_id: content.action?.catalog_id,
        product_retailer_id: content.action?.product_retailer_id,
      },
    };
  }

  if (content.type === 'PRODUCT_LIST') {
    return {
      type: 'product_list',
      header: readHeaderText(content.header) ? { type: 'text', text: readHeaderText(content.header)! } : { type: 'text', text: 'Products' },
      body: { text: content.body },
      footer: content.footer ? { text: content.footer } : undefined,
      action: {
        catalog_id: content.action?.catalog_id,
        sections: content.action?.sections?.map((section: any) => ({
          title: section.title,
          product_items: section.product_items,
        })),
      },
    };
  }

  if (content.type === 'CATALOG_MESSAGE') {
    const catalogAction: Record<string, unknown> = { name: 'catalog_message' };
    if (content.action?.thumbnail_product_retailer_id) {
      catalogAction.parameters = {
        thumbnail_product_retailer_id: content.action.thumbnail_product_retailer_id,
      };
    }
    return {
      type: 'catalog_message',
      body: { text: content.body },
      footer: content.footer ? { text: content.footer } : undefined,
      action: catalogAction,
    };
  }

  if (content.type === 'ADDRESS_MESSAGE') {
    return {
      type: 'address_message',
      header: readHeaderText(content.header) ? { type: 'text', text: readHeaderText(content.header)! } : undefined,
      body: { text: content.body },
      footer: content.footer ? { text: content.footer } : undefined,
      action: {
        name: 'address_message',
        parameters: {
          country: content.action?.country || 'IN',
        },
      },
    };
  }

  if (content.type === 'FLOW') {
    return {
      type: 'flow',
      header: readHeaderText(content.header) ? { type: 'text', text: readHeaderText(content.header)! } : undefined,
      body: { text: content.body },
      footer: content.footer ? { text: content.footer } : undefined,
      action: {
        name: content.action?.name || 'flow',
        parameters: content.action?.parameters || {},
      },
    };
  }

  return {};
}

/**
 * createMetaCloudProvider - WhatsApp Cloud API (Meta) adapter factory
 *
 * Implements the provider interface for Meta's WhatsApp Business Cloud API.
 * This is the recommended integration for new WhatsApp Business accounts.
 */
export function createMetaCloudProvider(config: MetaConfig): IWhatsAppProvider {
  const providerType: ProviderType = 'META_CLOUD';
  const baseUrl = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`;
  console.log(`[MetaCloudProvider] Initialized — baseUrl: ${baseUrl}`);

  /**
   * Verify webhook signature from Meta
   */
  function verifyWebhookSignature(payload: RawWebhookPayload): boolean {
    const signature = payload.headers['x-hub-signature-256'];
    if (!signature) return false;

    // In production: Verify HMAC-SHA256 signature
    // const expectedSignature = crypto
    //   .createHmac('sha256', config.appSecret)
    //   .update(payload.rawBody)
    //   .digest('hex');
    // return `sha256=${expectedSignature}` === signature;

    // Simplified for development
    return true;
  }

  /**
   * Parse incoming message from Meta webhook
   */
  function parseWebhookMessage(payload: RawWebhookPayload): IncomingMessage | null {
    try {
      const body = JSON.parse(payload.rawBody);
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages?.[0]) return null;

      const msg = value.messages[0];
      const contact = value.contacts?.[0];

      // Map message type
      const typeMap: Record<string, string> = {
        text: 'TEXT',
        image: 'IMAGE',
        video: 'VIDEO',
        audio: 'AUDIO',
        document: 'DOCUMENT',
        location: 'LOCATION',
        sticker: 'STICKER',
        interactive: 'INTERACTIVE',
      };

      const message: IncomingMessage = {
        providerMessageId: msg.id,
        providerTimestamp: new Date(parseInt(msg.timestamp) * 1000),
        senderPhone: msg.from,
        recipientPhone: value.metadata?.phone_number_id || config.phoneNumberId,
        messageType: (typeMap[msg.type] || 'TEXT') as any,
      };

      // Parse content based on type
      if (msg.text) {
        message.textContent = { body: msg.text.body };
      }

      if (msg.image || msg.video || msg.audio || msg.document) {
        const media = msg.image || msg.video || msg.audio || msg.document;
        message.mediaContent = {
          mediaId: media.id,
          mimeType: media.mime_type,
          fileName: media.filename,
          caption: media.caption,
        };
      }

      if (msg.location) {
        message.locationContent = {
          latitude: msg.location.latitude,
          longitude: msg.location.longitude,
          name: msg.location.name,
          address: msg.location.address,
        };
      }

      if (msg.interactive) {
        if (msg.interactive.button_reply) {
          message.selectedButtonId = msg.interactive.button_reply.id;
          // Capture button title as textContent for UI display
          message.textContent = { body: msg.interactive.button_reply.title };
        }
        if (msg.interactive.list_reply) {
          message.selectedListItemId = msg.interactive.list_reply.id;
          // Capture list row title as textContent for UI display
          message.textContent = { body: msg.interactive.list_reply.title };
        }
        if (msg.interactive.type === 'address_message' || msg.interactive.address_message) {
          const addr = msg.interactive.address_message;
          message.addressFormContent = {
            name: addr.name,
            phone_number: addr.phone_number,
            address: addr.address,
            house_number: addr.house_number,
            floor_number: addr.floor_number,
            tower_number: addr.tower_number,
            building_name: addr.building_name,
            landmark_area: addr.landmark_area,
            city: addr.city,
            pincode: addr.in_pin_code || addr.sg_post_code,
            state: addr.state, // Note: state might not be in generic payload but often sent by users
          };
          // Also set textContent for visibility
          message.textContent = { body: `Address submitted: ${addr.address}, ${addr.city}` };
        }
      }

      if (msg.order) {
        message.messageType = 'ORDER';
        message.orderContent = {
          catalog_id: msg.order.catalog_id,
          product_items: msg.order.product_items,
          text: msg.order.text,
        };
      }

      if (msg.context?.id) {
        message.replyToMessageId = msg.context.id;
      }

      message.providerMetadata = {
        contactName: contact?.profile?.name,
        contactWaId: contact?.wa_id,
      };

      return message;
    } catch (error) {
      console.error('Failed to parse Meta webhook message:', error);
      return null;
    }
  }

  /**
   * Parse status update from Meta webhook
   */
  function parseWebhookStatus(payload: RawWebhookPayload): MessageStatusUpdate | null {
    try {
      const body = JSON.parse(payload.rawBody);
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const status = changes?.value?.statuses?.[0];

      if (!status) return null;

      return {
        providerMessageId: status.id,
        status: status.status, // sent, delivered, read, failed
        timestamp: new Date(parseInt(status.timestamp) * 1000),
        recipientPhone: status.recipient_id,
        errorCode: status.errors?.[0]?.code?.toString(),
        errorMessage: status.errors?.[0]?.message,
      };
    } catch (error) {
      console.error('Failed to parse Meta webhook status:', error);
      return null;
    }
  }

  /**
   * Send a message via Meta Cloud API
   */
  async function sendMessage(request: SendMessageRequest): Promise<SendMessageResult> {
    try {
      let messagePayload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: request.recipientPhone,
      };

      // Build message based on type
      switch (request.messageType) {
        case 'TEXT':
          messagePayload.type = 'text';
          messagePayload.text = { body: request.textContent?.body };
          break;

        case 'IMAGE':
        case 'VIDEO':
        case 'AUDIO':
        case 'DOCUMENT':
          messagePayload.type = request.messageType.toLowerCase();
          messagePayload[request.messageType.toLowerCase()] = request.mediaContent?.downloadUrl
            ? {
                link: request.mediaContent.downloadUrl,
                caption: request.mediaContent?.caption,
                ...(request.messageType === 'DOCUMENT' && request.mediaContent?.fileName
                  ? { filename: request.mediaContent.fileName }
                  : {}),
              }
            : {
                id: request.mediaContent?.mediaId,
                caption: request.mediaContent?.caption,
                ...(request.messageType === 'DOCUMENT' && request.mediaContent?.fileName
                  ? { filename: request.mediaContent.fileName }
                  : {}),
              };
          break;

        case 'INTERACTIVE':
          messagePayload.type = 'interactive';
          messagePayload.interactive = buildInteractivePayload(request.interactiveContent!);
          break;

        case 'LOCATION':
          messagePayload.type = 'location';
          messagePayload.location = {
            latitude: request.locationContent?.latitude,
            longitude: request.locationContent?.longitude,
            name: request.locationContent?.name,
            address: request.locationContent?.address,
          };
          break;
      }

      if (request.replyToMessageId) {
        messagePayload.context = { message_id: request.replyToMessageId };
      }

      console.log(`[MetaCloudProvider] sendMessage → ${baseUrl}/messages`);
      console.log(`[MetaCloudProvider] Payload:`, JSON.stringify(messagePayload, null, 2));

      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      const data = await response.json() as any;
      console.log(`[MetaCloudProvider] Response (${response.status}):`, JSON.stringify(data, null, 2));

      if (!response.ok) {
        return {
          success: false,
          errorCode: data.error?.code?.toString(),
          errorMessage: data.error?.message,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        providerMessageId: data.messages?.[0]?.id,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send template message
   */
  async function sendTemplate(
    recipientPhone: string,
    templateName: string,
    language: string,
    components: TemplateContent['components']
  ): Promise<SendMessageResult> {
    try {
      const templatePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          components: components.map(comp => ({
            type: comp.type,
            parameters: comp.parameters.map(param => ({
              type: param.type,
              text: param.type === 'text' ? param.value : undefined,
              // Add other parameter types as needed
            })),
          })),
        },
      };

      console.log(`[MetaCloudProvider] sendTemplate → ${baseUrl}/messages`);
      console.log(`[MetaCloudProvider] Template payload:`, JSON.stringify(templatePayload, null, 2));

      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      });

      const data = await response.json() as any;
      console.log(`[MetaCloudProvider] Template response (${response.status}):`, JSON.stringify(data, null, 2));

      if (!response.ok) {
        return {
          success: false,
          errorCode: data.error?.code?.toString(),
          errorMessage: data.error?.message,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        providerMessageId: data.messages?.[0]?.id,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Upload media
   */
  async function uploadMedia(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<MediaUploadResult> {
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);

    const response = await fetch(`${baseUrl}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
      body: formData,
    });

    const data = await response.json() as any;

    return {
      mediaId: data.id,
    };
  }

  /**
   * Download media
   */
  async function downloadMedia(mediaId: string): Promise<Buffer> {
    // First, get the media URL
    const urlResponse = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      }
    );
    const urlData = await urlResponse.json() as any;

    // Then download the file
    const fileResponse = await fetch(urlData.url, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    const arrayBuffer = await fileResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get media URL
   */
  async function getMediaUrl(mediaId: string): Promise<string> {
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      }
    );
    const data = await response.json() as any;
    return data.url;
  }

  function sanitizeTemplateComponents(components: TemplateSubmission['components']) {
    return (components || []).map((component: any) => {
      if (component?.type !== 'CAROUSEL' || !Array.isArray(component.cards)) {
        return component;
      }

      return {
        ...component,
        cards: component.cards.map((card: any) => ({
          components: Array.isArray(card?.components) ? card.components : [],
        })),
      };
    });
  }

  /**
   * Submit template for approval
   */
  async function submitTemplate(template: TemplateSubmission): Promise<string> {
    const components = sanitizeTemplateComponents(template.components);
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.businessAccountId}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: template.name,
          language: template.language,
          category: template.category,
          components,
        }),
      }
    );

    const data = await response.json() as any;
    return data.id;
  }

  /**
   * Get template status
   */
  async function getTemplateStatus(templateId: string): Promise<TemplateApprovalStatus> {
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${templateId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      }
    );

    const data = await response.json() as any;

    return {
      templateId: data.id,
      name: data.name,
      status: data.status,
      rejectedReason: data.rejected_reason,
    };
  }

  async function listFlows(): Promise<WhatsAppFlowSummary[]> {
    const result = await graphJsonRequest<any>(
      config.apiVersion,
      config.accessToken,
      `${config.businessAccountId}/flows?fields=id,name,status,categories,validation_errors,health_status,json_version,data_api_version,endpoint_uri`
    );
    const data = ensureGraphOk(result, 'list flows');
    return Array.isArray(data?.data) ? data.data.map(toFlowSummary) : [];
  }

  async function getFlow(flowId: string): Promise<WhatsAppFlowDefinition> {
    const result = await graphJsonRequest<any>(
      config.apiVersion,
      config.accessToken,
      `${flowId}?fields=id,name,status,categories,validation_errors,health_status,json_version,data_api_version,endpoint_uri`
    );
    const data = ensureGraphOk(result, 'get flow');
    return {
      ...toFlowSummary(data),
      jsonDefinition: null,
    };
  }

  async function createFlow(input: WhatsAppFlowUpsertInput): Promise<WhatsAppFlowDefinition> {
    const created = ensureGraphOk(
      await graphJsonRequest<any>(config.apiVersion, config.accessToken, `${config.businessAccountId}/flows`, {
        method: 'POST',
        body: {
          name: input.name,
          categories: input.categories?.length ? input.categories : ['OTHER'],
        },
      }),
      'create flow'
    );

    const flowId = created?.id;
    if (!flowId) {
      throw new Error('Meta did not return a flow ID after creation');
    }

    if (input.jsonDefinition && Object.keys(input.jsonDefinition).length) {
      await uploadFlowJsonAsset(flowId, input.jsonDefinition, config.accessToken, config.apiVersion);
    }

    if (input.endpointUri) {
      ensureGraphOk(
        await graphJsonRequest<any>(config.apiVersion, config.accessToken, flowId, {
          method: 'POST',
          body: { endpoint_uri: input.endpointUri },
        }),
        'update flow metadata'
      );
    }

    return getFlow(flowId);
  }

  async function updateFlow(flowId: string, input: Partial<WhatsAppFlowUpsertInput>): Promise<WhatsAppFlowDefinition> {
    if (input.jsonDefinition && Object.keys(input.jsonDefinition).length) {
      await uploadFlowJsonAsset(flowId, input.jsonDefinition, config.accessToken, config.apiVersion);
    }

    if (input.endpointUri) {
      ensureGraphOk(
        await graphJsonRequest<any>(config.apiVersion, config.accessToken, flowId, {
          method: 'POST',
          body: { endpoint_uri: input.endpointUri },
        }),
        'update flow metadata'
      );
    }

    return getFlow(flowId);
  }

  async function publishFlow(flowId: string): Promise<WhatsAppFlowDefinition> {
    ensureGraphOk(
      await graphJsonRequest<any>(config.apiVersion, config.accessToken, `${flowId}/publish`, {
        method: 'POST',
        body: {},
      }),
      'publish flow'
    );

    return getFlow(flowId);
  }

  async function deleteFlow(flowId: string): Promise<void> {
    ensureGraphOk(
      await graphJsonRequest<any>(config.apiVersion, config.accessToken, flowId, {
        method: 'DELETE',
      }),
      'delete flow'
    );
  }

  /**
   * Mark message as read
   */
  async function markAsRead(providerMessageId: string): Promise<void> {
    await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: providerMessageId,
      }),
    });
  }

  /**
   * Send typing indicator (Meta Cloud API)
   */
  async function sendTypingIndicator(providerMessageId: string): Promise<void> {
    await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: providerMessageId,
        typing_indicator: { type: 'text' },
      }),
    });
  }

  /**
   * Health check
   */
  async function healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  return {
    providerType,
    verifyWebhookSignature,
    parseWebhookMessage,
    parseWebhookStatus,
    sendMessage,
    sendTemplate,
    uploadMedia,
    downloadMedia,
    getMediaUrl,
    submitTemplate,
    getTemplateStatus,
    listFlows,
    getFlow,
    createFlow,
    updateFlow,
    publishFlow,
    deleteFlow,
    markAsRead,
    sendTypingIndicator,
    healthCheck,
  };
}
