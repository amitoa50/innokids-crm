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

// Edit a template's body. Under the real (cloud) provider, editing an APPROVED
// template revokes the approval (status -> DRAFT): Meta approves exact wording,
// so changed text must not keep sending as if approved. The dispatch loop's
// NO_APPROVED_TEMPLATE rail then holds sends until re-approval. Under mock the
// status is a dev convenience and stays untouched.
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

  const approvalRevoked = template.status === "APPROVED" && getWhatsAppConfig().provider === "cloud"
  const updated = await prisma.messageTemplate.update({
    where: { id },
    data: { body, ...(approvalRevoked ? { status: "DRAFT" } : {}) }
  })
  return { template: updated, approvalRevoked }
}
