import crypto from "crypto"
import type { WhatsAppConfig } from "../../lib/whatsappConfig"
import type { WhatsAppProvider, ParsedWebhook, SendResult, NormalizedInboundMessage, NormalizedStatusUpdate } from "./provider"

// Meta WhatsApp Cloud API adapter (the recommended long-term default).
export class CloudApiProvider implements WhatsAppProvider {
  constructor(private config: WhatsAppConfig) {}

  private get baseUrl(): string {
    return `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`
  }

  private async post(payload: Record<string, unknown>): Promise<SendResult> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message?: string } }
    if (!res.ok || !data.messages?.[0]?.id) {
      throw new Error(`WhatsApp send failed: ${data.error?.message || res.statusText}`)
    }
    return { externalId: data.messages[0].id }
  }

  async sendSessionMessage(toPhone: string, body: string): Promise<SendResult> {
    return this.post({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body }
    })
  }

  async sendTemplate(toPhone: string, templateName: string, language: string, variables: string[]): Promise<SendResult> {
    const components = variables.length
      ? [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: v })) }]
      : []
    return this.post({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components
      }
    })
  }

  verifyChallenge(query: Record<string, unknown>): string | null {
    const mode = query["hub.mode"]
    const token = query["hub.verify_token"]
    const challenge = query["hub.challenge"]
    if (mode === "subscribe" && token === this.config.verifyToken && typeof challenge === "string") {
      return challenge
    }
    return null
  }

  verifySignature(signatureHeader: string | undefined, rawBody: string): boolean {
    if (!signatureHeader || !this.config.appSecret) return false
    const expected = "sha256=" + crypto.createHmac("sha256", this.config.appSecret).update(rawBody).digest("hex")
    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
    } catch {
      return false
    }
  }

  parseWebhook(payload: Record<string, unknown>): ParsedWebhook {
    const inboundMessages: NormalizedInboundMessage[] = []
    const statusUpdates: NormalizedStatusUpdate[] = []

    const entries = (payload.entry as Array<Record<string, unknown>>) || []
    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) || []
      for (const change of changes) {
        const value = (change.value as Record<string, unknown>) || {}

        const messages = (value.messages as Array<Record<string, unknown>>) || []
        for (const m of messages) {
          const text = (m.text as { body?: string }) || {}
          inboundMessages.push({
            fromPhone: String(m.from || ""),
            externalId: String(m.id || ""),
            body: text.body || "",
            timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000) : undefined
          })
        }

        const statuses = (value.statuses as Array<Record<string, unknown>>) || []
        for (const s of statuses) {
          statusUpdates.push({
            externalId: String(s.id || ""),
            status: String(s.status || "").toUpperCase()
          })
        }
      }
    }

    return { inboundMessages, statusUpdates }
  }
}
