// Resolves the `source` value stamped on a lead at creation time.
//
// Priority: explicit source on the request > the customer's existing source >
// inferred channel from the contact's phone. Instagram contacts are stored with
// an `ig_`-prefixed phone (the channel contact id), so an Instagram-originated
// lead must surface as `instagram` rather than falling through to the WhatsApp
// default. Without this, IG DM leads display as "WhatsApp" in the CRM even though
// their phone clearly shows an Instagram origin.

function isInstagramPhone(value: unknown): boolean {
  return String(value || '').trim().startsWith('ig_');
}

export function resolveLeadSource(
  data: { source?: string; customerPhone?: string } | null | undefined,
  customer: { source?: string; phone?: string } | null | undefined,
): string {
  const explicit = data?.source || customer?.source;
  if (explicit) return explicit;

  if (isInstagramPhone(customer?.phone) || isInstagramPhone(data?.customerPhone)) {
    return 'instagram';
  }

  return 'whatsapp_organic';
}
