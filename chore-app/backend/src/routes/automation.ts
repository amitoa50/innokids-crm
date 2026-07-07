import { Router, Request, Response } from "express"
import { authenticate, requireAdmin } from "../middleware/auth"
import prisma from "../lib/prisma"
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
  const id = Number(req.params.id)
  const { body } = req.body

  if (typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Template body is required" },
      requestId: req.requestId
    })
    return
  }

  const template = await prisma.messageTemplate.findUnique({ where: { id } })
  if (!template) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Template not found" },
      requestId: req.requestId
    })
    return
  }

  // Body may only use placeholders the automation actually fills: {{1}}..{{N}}
  const variables = template.variables ? (JSON.parse(template.variables) as string[]) : []
  const maxIndex = variables.length
  const tokens = body.match(/\{\{[^}]*\}\}/g) || []
  for (const token of tokens) {
    const inner = token.replace(/[{}\s]/g, "")
    const n = Number(inner)
    if (!/^\d+$/.test(inner) || n < 1 || n > maxIndex) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: `Invalid placeholder ${token} — allowed range is {{1}}..{{${maxIndex}}}` },
        requestId: req.requestId
      })
      return
    }
  }

  const updated = await prisma.messageTemplate.update({ where: { id }, data: { body } })
  res.json(updated)
})

export default router
