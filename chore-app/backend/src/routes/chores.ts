import { Router, Request, Response } from "express"
import { authenticate, requireAdmin } from "../middleware/auth"
import { createNextOccurrence } from "../services/recurrence"
import { sendChoreAssignedEmail, sendChoreCompletedEmail } from "../services/email"
import prisma from "../lib/prisma"
const router = Router()

router.use(authenticate)

// GET / — List chores
router.get("/", async (req: Request, res: Response) => {
  const { status, assignedToId } = req.query
  const where: Record<string, unknown> = {}

  if (status) {
    where.status = status as string
  }
  if (assignedToId) {
    where.assignedToId = Number(assignedToId)
  }
  if (req.user!.role !== "ADMIN") {
    where.assignedToId = req.user!.userId
  }

  const chores = await prisma.chore.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, email: true, name: true, role: true } },
      createdBy: { select: { id: true, email: true, name: true, role: true } }
    },
    orderBy: { dueDate: "asc" }
  })

  res.json(chores)
})

// POST / — Create chore (admin only)
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { title, description, recurrence, dueDate, assignedToId } = req.body

  if (!title || !dueDate || !assignedToId) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Title, dueDate, and assignedToId are required" } })
    return
  }

  const chore = await prisma.chore.create({
    data: {
      title,
      description: description || null,
      recurrence: recurrence || "NONE",
      dueDate: new Date(dueDate),
      assignedToId: Number(assignedToId),
      createdById: req.user!.userId
    },
    include: {
      assignedTo: { select: { id: true, email: true, name: true, role: true } },
      createdBy: { select: { id: true, email: true, name: true, role: true } }
    }
  })

  await prisma.notification.create({
    data: {
      message: `New chore assigned: ${title}`,
      userId: Number(assignedToId)
    }
  })

  await sendChoreAssignedEmail(chore.assignedTo.email, title)

  res.status(201).json(chore)
})

// PUT /:id — Update chore (admin only)
router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { title, description, recurrence, dueDate, assignedToId, status } = req.body

  const existing = await prisma.chore.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Chore not found" } })
    return
  }

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (description !== undefined) data.description = description
  if (recurrence !== undefined) data.recurrence = recurrence
  if (dueDate !== undefined) data.dueDate = new Date(dueDate)
  if (assignedToId !== undefined) data.assignedToId = Number(assignedToId)
  if (status !== undefined) data.status = status

  const chore = await prisma.chore.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, email: true, name: true, role: true } },
      createdBy: { select: { id: true, email: true, name: true, role: true } }
    }
  })

  res.json(chore)
})

// DELETE /:id — Delete chore (admin only)
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  const existing = await prisma.chore.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Chore not found" } })
    return
  }

  await prisma.chore.delete({ where: { id } })
  res.json({ message: "Chore deleted" })
})

// POST /:id/complete — Mark chore complete
router.post("/:id/complete", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { notes } = req.body

  const existing = await prisma.chore.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, email: true, name: true, role: true } }
    }
  })
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Chore not found" } })
    return
  }

  const data: Record<string, unknown> = {
    status: "COMPLETED",
    completedAt: new Date()
  }
  if (notes) data.notes = notes

  const chore = await prisma.chore.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, email: true, name: true, role: true } },
      createdBy: { select: { id: true, email: true, name: true, role: true } }
    }
  })

  if (existing.recurrence !== "NONE") {
    await createNextOccurrence(existing, existing.createdById)
  }

  await prisma.notification.create({
    data: {
      message: `Chore completed: ${existing.title}`,
      userId: existing.createdById
    }
  })

  await sendChoreCompletedEmail(existing.createdBy.email, existing.title)

  res.json(chore)
})

export default router
