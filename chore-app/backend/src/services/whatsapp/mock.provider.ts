import { randomUUID } from "crypto"
import type { WhatsAppConfig } from "../../lib/whatsappConfig"
import type { WhatsAppProvider, ParsedWebhook, SendResult, NormalizedInboundMessage, NormalizedStatusUpdate } from "./provider"

// Local-dev adapter: no external calls. Sends return a fake id; webhooks accept a
// simplified shape so inbound/status flows can be simulated with plain curl.
export class MockProvider implements WhatsAppProvider {
  constructor(private config: WhatsAppConfig) {}

  async sendSessionMessage(toPhone: string, body: string): Promise<SendResult> {
    const externalId = `mock-${randomUUID()}`
    console.log(`[mock-whatsapp] session -> ${toPhone}: ${body} (${externalId})`)
    return { externalId }
  }

  async sendTemplate(toPhone: string, templateName: string, _language: string, variables: string[]): Promise<SendResult> {
    const externalId = `mock-${randomUUID()}`
    console.log(`[mock-whatsapp] template ${templateName} -> ${toPhone} [${variables.join(", ")}] (${externalId})`)
    return { externalId }
  }

  verifyChallenge(query: Record<string, unknown>): string | null {
    const token = query["hub.verify_token"]
    const challenge = query["hub.challenge"]
    if (token === this.config.verifyToken && typeof challenge === "string") return challenge
    return null
  }

  verifySignature(): boolean {
    return true
  }

  parseWebhook(payload: Record<string, unknown>): ParsedWebhook {
    const inbound = (payload.inbound as Array<Record<string, unknown>>) || []
    const statuses = (payload.statuses as Array<Record<string, unknown>>) || []

    const inboundMessages: NormalizedInboundMessage[] = inbound.map((m) => ({
      fromPhone: String(m.fromPhone || ""),
      externalId: String(m.externalId || `mock-in-${randomUUID()}`),
      body: String(m.body || "")
    }))

    const statusUpdates: NormalizedStatusUpdate[] = statuses.map((s) => ({
      externalId: String(s.externalId || ""),
      status: String(s.status || "").toUpperCase()
    }))

    return { inboundMessages, statusUpdates }
  }
}
