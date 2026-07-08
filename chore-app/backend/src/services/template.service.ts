import prisma from "../lib/prisma"
import { getWhatsAppConfig } from "../lib/whatsappConfig"
import type { MessageTemplate } from "@prisma/client"

interface UpdateBodyError {
  error: { code: "NOT_FOUND" | "BAD_REQUEST"; message: string }
}

interface UpdateBodySuccess {
  template: MessageTemplate
  approvalRevoked: boolean
}

const TEMPLATE_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"]
const TEMPLATE_CATEGORIES = ["UTILITY", "MARKETING", "AUTHENTICATION"]

// Edit a template's body. Under the real (cloud) provider, editing an APPROVED
// or PENDING template resets it to DRAFT: Meta approves exact wording, so text
// that changed after submission must not send (or stay queued) as if approved.
// The dispatch loop's NO_APPROVED_TEMPLATE rail then holds sends until
// re-approval. Under mock the status is a dev convenience and stays untouched.
export async function updateTemplateBody(id: number, body: unknown): Promise<UpdateBodyError | UpdateBodySuccess> {
  if (typeof body !== "string" || body.trim().length === 0) {
    return { error: { code: "BAD_REQUEST", message: "Template body is required" } }
  }

  const template = await prisma.messageTemplate.findUnique({ where: { id } })
  if (!template) {
    return { error: { code: "NOT_FOUND", message: "Template not found" } }
  }

  // Body may only use placeholders the automation actually fills: {{1}}..{{N}}
  const variables = template.variables ? (JSON.parse(template.variables) as string[]) : []
  const maxIndex = variables.length
  const tokens = body.match(/\{\{[^}]*\}\}/g) || []
  for (const token of tokens) {
    const inner = token.replace(/[{}\s]/g, "")
    const n = Number(inner)
    if (!/^\d+$/.test(inner) || n < 1 || n > maxIndex) {
      return {
        error: { code: "BAD_REQUEST", message: `Invalid placeholder ${token} — allowed range is {{1}}..{{${maxIndex}}}` }
      }
    }
  }

  const approvalRevoked =
    (template.status === "APPROVED" || template.status === "PENDING") && getWhatsAppConfig().provider === "cloud"
  const updated = await prisma.messageTemplate.update({
    where: { id },
    data: { body, ...(approvalRevoked ? { status: "DRAFT" } : {}) }
  })
  return { template: updated, approvalRevoked }
}

// Record the Meta-side approval outcome (manual sync — the admin is the bridge
// to WhatsApp Manager this phase). Optionally syncs the category Meta assigned,
// which drives the marketing-consent dispatch gate.
export async function updateTemplateStatus(
  id: number,
  params: { status: unknown; category?: unknown }
): Promise<UpdateBodyError | { template: MessageTemplate }> {
  if (typeof params.status !== "string" || !TEMPLATE_STATUSES.includes(params.status)) {
    return {
      error: { code: "BAD_REQUEST", message: `Invalid status — allowed: ${TEMPLATE_STATUSES.join(", ")}` }
    }
  }
  if (params.category !== undefined) {
    if (typeof params.category !== "string" || !TEMPLATE_CATEGORIES.includes(params.category)) {
      return {
        error: { code: "BAD_REQUEST", message: `Invalid category — allowed: ${TEMPLATE_CATEGORIES.join(", ")}` }
      }
    }
  }

  const template = await prisma.messageTemplate.findUnique({ where: { id } })
  if (!template) {
    return { error: { code: "NOT_FOUND", message: "Template not found" } }
  }

  const updated = await prisma.messageTemplate.update({
    where: { id },
    data: { status: params.status, ...(params.category !== undefined ? { category: params.category as string } : {}) }
  })
  return { template: updated }
}
