import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import prisma from "../lib/prisma"
const router = Router()

router.use(authenticate)

// GET / — List notifications for current user
router.get("/", async (req: Request, res: Response) => {
  const where: Record<string, unknown> = { userId: req.user!.userId }

  if (req.query.unreadOnly === "true") {
    where.read = false
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" }
  })

  res.json(notifications)
})

// PUT /:id/read — Mark notification as read
router.put("/:id/read", async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } })
    return
  }

  if (notification.userId !== req.user!.userId) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Not your notification" } })
    return
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true }
  })

  res.json(updated)
})

export default router
