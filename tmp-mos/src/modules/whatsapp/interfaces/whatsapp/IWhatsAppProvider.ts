// domain/interfaces/whatsapp/IWhatsAppProvider.ts
// Provider abstraction - swap between Meta, Twilio, etc.

import {
  WhatsAppMessage,
  MessageType,
  TextContent,
  MediaContent,
  InteractiveContent,
  TemplateContent,
  LocationContent,
  AddressFormContent,
} from '../../models/whatsapp/WhatsAppMessage.js';

/**
 * Provider identification
 */
export type ProviderType = 'META_CLOUD' | 'TWILIO' | 'GUPSHUP' | 'WATI';

/**
 * Webhook event types from provider
 */
export type WebhookEventType =
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_STATUS'
  | 'TEMPLATE_STATUS'
  | 'PHONE_NUMBER_CHANGE'
  | 'ACCOUNT_UPDATE'
  | 'ERROR';

/**
 * Raw webhook payload (before normalization)
 */
export interface RawWebhookPayload {
  provider: ProviderType;
  eventType: WebhookEventType;
  timestamp: Date;
  rawBody: string;
  signature?: string;
  headers: Record<string, string>;
}

/**
 * Normalized incoming message
 */
export interface IncomingMessage {
  providerMessageId: string;
  providerTimestamp: Date;
  senderPhone: string;
  recipientPhone: string;  // Business number
  messageType: MessageType;
  textContent?: TextContent;
  mediaContent?: MediaContent;
  locationContent?: LocationContent;
  replyToMessageId?: string;
  selectedButtonId?: string;
  selectedListItemId?: string;
  orderContent?: any; // Replace with proper OrderContent import later
  addressFormContent?: AddressFormContent;
  providerMetadata?: Record<string, unknown>;
}

/**
 * Status update for sent message
 */
export interface MessageStatusUpdate {
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  recipientPhone: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Outbound message request
 */
export interface SendMessageRequest {
  recipientPhone: string;
  messageType: MessageType;
  textContent?: TextContent;
  mediaContent?: MediaContent;
  interactiveContent?: InteractiveContent;
  templateContent?: TemplateContent;
  locationContent?: LocationContent;
  replyToMessageId?: string;
}

/**
 * Send result
 */
export interface SendMessageResult {
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

/**
 * Template submission for approval
 */
export interface TemplateSubmission {
  name: string;
  language: string;
  category: 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: {
      header_text?: string[];
      body_text?: string[][];
    };
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

/**
 * Template approval status
 */
export interface TemplateApprovalStatus {
  templateId: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  rejectedReason?: string;
}

/**
 * Media upload result
 */
export interface MediaUploadResult {
  mediaId: string;
  url?: string;
  expiresAt?: Date;
}

/**
 * IWhatsAppProvider - Provider abstraction interface
 * 
 * CRITICAL: All provider-specific logic is encapsulated here.
 * The rest of the system works with normalized data.
 */
export interface IWhatsAppProvider {
  /**
   * Provider identification
   */
  readonly providerType: ProviderType;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: RawWebhookPayload): boolean;

  /**
   * Parse webhook payload into normalized message
   */
  parseWebhookMessage(payload: RawWebhookPayload): IncomingMessage | null;

  /**
   * Parse webhook payload into status update
   */
  parseWebhookStatus(payload: RawWebhookPayload): MessageStatusUpdate | null;

  /**
   * Send a message
   */
  sendMessage(request: SendMessageRequest): Promise<SendMessageResult>;

  /**
   * Send a template message
   */
  sendTemplate(
    recipientPhone: string,
    templateName: string,
    language: string,
    components: TemplateContent['components']
  ): Promise<SendMessageResult>;

  /**
   * Upload media for sending
   */
  uploadMedia(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<MediaUploadResult>;

  /**
   * Download media from received message
   */
  downloadMedia(mediaId: string): Promise<Buffer>;

  /**
   * Get media URL (for display)
   */
  getMediaUrl(mediaId: string): Promise<string>;

  /**
   * Submit template for approval
   */
  submitTemplate(template: TemplateSubmission): Promise<string>;

  /**
   * Check template approval status
   */
  getTemplateStatus(templateId: string): Promise<TemplateApprovalStatus>;

  /**
   * Mark message as read
   */
  markAsRead(providerMessageId: string): Promise<void>;

  /**
   * Send typing indicator for an inbound message context
   */
  sendTypingIndicator(providerMessageId: string): Promise<void>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}
