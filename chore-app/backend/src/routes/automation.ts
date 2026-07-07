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

export default router
