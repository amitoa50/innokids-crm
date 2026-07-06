// Provider-agnostic WhatsApp adapter contract.
// Concrete adapters (Cloud API, mock, future BSPs) implement this so the rest of
// the CRM never depends on a specific vendor.

export interface NormalizedInboundMessage {
  fromPhone: string
  externalId: string
  body: string
  timestamp?: Date
}

export interface NormalizedStatusUpdate {
  externalId: string // provider message id
  status: string // SENT, DELIVERED, READ, FAILED
}

export interface ParsedWebhook {
  inboundMessages: NormalizedInboundMessage[]
  statusUpdates: NormalizedStatusUpdate[]
}

export interface SendResult {
  externalId: string
}

export interface WhatsAppProvider {
  // Free-form message, only valid inside the 24h service window
  sendSessionMessage(toPhone: string, body: string): Promise<SendResult>
  // Approved template message, valid outside the service window
  sendTemplate(toPhone: string, templateName: string, language: string, variables: string[]): Promise<SendResult>
  // GET webhook verification challenge; returns the echo string when the token matches, else null
  verifyChallenge(query: Record<string, unknown>): string | null
  // POST webhook signature validation over the raw request body
  verifySignature(signatureHeader: string | undefined, rawBody: string): boolean
  // Normalize an inbound webhook payload into messages + status updates
  parseWebhook(payload: Record<string, unknown>): ParsedWebhook
}
