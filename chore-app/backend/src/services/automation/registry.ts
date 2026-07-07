import prisma from "../../lib/prisma"
import type { Lead, ScheduledMessage } from "@prisma/client"

// Snapshot passed at enqueue time — used to compute dueAt and resolve template variables.
export interface RuleContext {
  leadId: number
  entityType: string // LEAD, TRIAL_LESSON, STUDENT
  entityId: number
  baseTime: Date // the moment the offset is measured from (event time, or trial scheduledAt for the reminder)
  parentName: string
  childName?: string
  scheduledAt?: Date
}

interface GuardResult {
  ok: boolean
  reason?: string
}

export interface RuleDef {
  resolveVariables: (ctx: RuleContext) => string[]
  guard: (row: ScheduledMessage, lead: Lead) => Promise<GuardResult>
}

function fmtDate(d?: Date): string {
  return d ? new Date(d).toLocaleDateString("he-IL") : ""
}

function fmtTime(d?: Date): string {
  return d ? new Date(d).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : ""
}

// Per-trigger variable resolution (at enqueue) and stop-condition re-check (at dispatch).
export const registry: Record<string, RuleDef> = {
  LEAD_WELCOME: {
    resolveVariables: (ctx) => [ctx.parentName],
    guard: async (row, lead) => {
      if (lead.status === "CLOSED") return { ok: false, reason: "LEAD_CLOSED" }
      const priorOutbound = await prisma.message.count({
        where: { direction: "OUTBOUND", channel: "WHATSAPP", conversation: { leadId: row.leadId } }
      })
      if (priorOutbound > 0) return { ok: false, reason: "ALREADY_CONTACTED" }
      return { ok: true }
    }
  },
  NO_RESPONSE_NUDGE: {
    resolveVariables: (ctx) => [ctx.parentName],
    guard: async (_row, lead) =>
      lead.status === "NO_RESPONSE" ? { ok: true } : { ok: false, reason: "NOT_NO_RESPONSE" }
  },
  TRIAL_CONFIRMATION: {
    resolveVariables: (ctx) => [ctx.parentName, fmtDate(ctx.scheduledAt), fmtTime(ctx.scheduledAt)],
    guard: async (row) => {
      const trial = await prisma.trialLesson.findUnique({ where: { id: row.entityId ?? -1 } })
      return trial && trial.status === "SCHEDULED" ? { ok: true } : { ok: false, reason: "TRIAL_NOT_SCHEDULED" }
    }
  },
  TRIAL_REMINDER: {
    resolveVariables: (ctx) => [ctx.parentName, fmtDate(ctx.scheduledAt), fmtTime(ctx.scheduledAt)],
    guard: async (row) => {
      const trial = await prisma.trialLesson.findUnique({ where: { id: row.entityId ?? -1 } })
      if (!trial || trial.status !== "SCHEDULED") return { ok: false, reason: "TRIAL_NOT_SCHEDULED" }
      if (trial.scheduledAt <= new Date()) return { ok: false, reason: "TRIAL_PASSED" }
      return { ok: true }
    }
  },
  POST_TRIAL_FOLLOW_UP: {
    resolveVariables: (ctx) => [ctx.parentName, ctx.childName ?? ""],
    guard: async (_row, lead) =>
      lead.status === "CONVERTED" || lead.status === "CLOSED"
        ? { ok: false, reason: `LEAD_${lead.status}` }
        : { ok: true }
  },
  TRIAL_NO_SHOW_RESCHEDULE: {
    resolveVariables: (ctx) => [ctx.parentName],
    guard: async (row) => {
      const trial = await prisma.trialLesson.findUnique({ where: { id: row.entityId ?? -1 } })
      if (!trial || trial.status !== "NO_SHOW") return { ok: false, reason: "TRIAL_NOT_NO_SHOW" }
      const newer = await prisma.trialLesson.count({
        where: { leadId: row.leadId, status: "SCHEDULED", id: { not: row.entityId ?? -1 } }
      })
      if (newer > 0) return { ok: false, reason: "RESCHEDULED" }
      return { ok: true }
    }
  },
  STUDENT_WELCOME: {
    resolveVariables: (ctx) => [ctx.parentName, ctx.childName ?? ""],
    guard: async (row) => {
      const student = await prisma.student.findUnique({ where: { id: row.entityId ?? -1 } })
      return student ? { ok: true } : { ok: false, reason: "STUDENT_NOT_FOUND" }
    }
  }
}
