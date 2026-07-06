import prisma from "../../lib/prisma"
import { getProvider } from "./index"
import { getOrCreateConversation, logMessage } from "../communication.service"
import { linkExternalId } from "../externalRef.service"

interface SendParams {
  body?: string
  templateName?: string
  language?: string
  variables?: string[]
}

function interpolate(template: string, variables: string[] = []): string {
  return template.replace(/\{\{(\d+)\}\}/g, (_m, n) => variables[Number(n) - 1] ?? `{{${n}}}`)
}

// Sends a WhatsApp message for a lead, enforcing consent and the 24h service window.
// Returns { message } on success or a discriminated domain error.
export async function sendWhatsApp(leadId: number, params: SendParams, sentById?: number) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) return { error: "LEAD_NOT_FOUND" as const }
  if (!lead.whatsappConsent) return { error: "NO_CONSENT" as const }

  const windowOpen = !!lead.whatsappWindowExpiresAt && lead.whatsappWindowExpiresAt > new Date()
  const provider = getProvider()
  const toPhone = lead.phoneNormalized.replace(/^\+/, "")

  let externalId: string
  let bodyText: string

  if (params.templateName) {
    const tpl = await prisma.messageTemplate.findUnique({ where: { name: params.templateName } })
    if (tpl && tpl.status !== "APPROVED") return { error: "TEMPLATE_NOT_APPROVED" as const }
    const language = params.language || tpl?.language || "he"
    bodyText = tpl ? interpolate(tpl.body, params.variables) : `[template:${params.templateName}]`
    const result = await provider.sendTemplate(toPhone, params.templateName, language, params.variables || [])
    externalId = result.externalId
  } else {
    if (!params.body) return { error: "EMPTY_BODY" as const }
    if (!windowOpen) return { error: "WINDOW_CLOSED_NO_TEMPLATE" as const }
    bodyText = params.body
    const result = await provider.sendSessionMessage(toPhone, params.body)
    externalId = result.externalId
  }

  const conversation = await getOrCreateConversation({ leadId }, "WHATSAPP")
  const message = await logMessage(
    { conversationId: conversation.id, direction: "OUTBOUND", channel: "WHATSAPP", body: bodyText, sentById, status: "SENT" },
    sentById
  )

  await linkExternalId({
    entityType: "MESSAGE",
    entityId: message.id,
    system: "WHATSAPP",
    externalId
  })

  return { message }
}
