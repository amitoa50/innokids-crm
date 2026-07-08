import { Router, Request, Response } from "express"
import { authenticate, requireAdmin } from "../middleware/auth"
import prisma from "../lib/prisma"
import { updateTemplateBody, updateTemplateStatus } from "../services/template.service"
const router = Router()

router.use(authenticate)
router.use(requireAdmin)

const OUTBOX_STATUSES = ["PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"]
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

router.get("/rule", async (_req: Request, res: Response) => {
  const rules = await prisma.automationRule.findMany({ orderBy: { id: "asc" } })
  res.json(rules)
})

router.get("/scheduled-message", async (req: Request, res: Response) => {
  const statusParam = typeof req.query.status === "string" ? req.query.status : undefined
  const status = statusParam && OUTBOX_STATUSES.includes(statusParam) ? statusParam : undefined

  const limitRaw = Number(req.query.limit)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), MAX_LIMIT) : DEFAULT_LIMIT

  const grouped = await prisma.scheduledMessage.groupBy({
    by: ["status"],
    _count: { _all: true }
  })
  const counts: Record<string, number> = {}
  for (const s of OUTBOX_STATUSES) counts[s] = 0
  for (const g of grouped) counts[g.status] = g._count._all

  const rows = await prisma.scheduledMessage.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { lead: { select: { id: true, fullName: true } } }
  })

  const items = rows.map((r) => ({
    id: r.id,
    status: r.status,
    templateName: r.templateName,
    triggerEvent: (r.dedupeKey || "").split(":")[0],
    dueAt: r.dueAt,
    failureReason: r.failureReason,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lead: r.lead
  }))

  res.json({ counts, items })
})

router.get("/template", async (_req: Request, res: Response) => {
  const [templates, rules] = await Promise.all([
    prisma.messageTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.automationRule.findMany()
  ])

  const items = templates.map((t) => ({
    id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    body: t.body,
    status: t.status,
    variables: t.variables ? (JSON.parse(t.variables) as string[]) : [],
    usedBy: rules
      .filter((r) => r.templateName === t.name)
      .map((r) => ({ triggerEvent: r.triggerEvent, name: r.name }))
  }))

  res.json(items)
})

router.put("/template/:id", async (req: Request, res: Response) => {
  const result = await updateTemplateBody(Number(req.params.id), req.body?.body)

  if ("error" in result) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400
    res.status(status).json({ error: result.error, requestId: req.requestId })
    return
  }

  res.json({ ...result.template, approvalRevoked: result.approvalRevoked })
})

router.put("/template/:id/status", async (req: Request, res: Response) => {
  const result = await updateTemplateStatus(Number(req.params.id), {
    status: req.body?.status,
    category: req.body?.category
  })

  if ("error" in result) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400
    res.status(status).json({ error: result.error, requestId: req.requestId })
    return
  }

  res.json(result.template)
})

export default router
