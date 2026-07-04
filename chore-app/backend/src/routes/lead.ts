import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import prisma from "../lib/prisma"
import * as leadService from "../services/lead.service"
const router = Router()

router.use(authenticate)

router.get("/", async (req: Request, res: Response) => {
  const { status, source, assignedToId, search, learningFormat } = req.query

  const leads = await prisma.lead.findMany({
    where: {
      ...(status && { status: status as string }),
      ...(source && { source: source as string }),
      ...(assignedToId && { assignedToId: Number(assignedToId) }),
      ...(learningFormat && { learningFormat: learningFormat as string }),
      ...(search && {
        OR: [
          { fullName: { contains: search as string } },
          { phone: { contains: search as string } },
          { email: { contains: search as string } }
        ]
      })
    },
    include: {
      assignedTo: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  })

  res.json(leads)
})

router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      students: true,
      trialLessons: {
        include: {
          group: { select: { name: true } },
          teacher: { select: { name: true } }
        },
        orderBy: { scheduledAt: "desc" }
      },
      tasks: {
        include: { assignedTo: { select: { name: true } } },
        orderBy: { createdAt: "desc" }
      },
      activityLogs: {
        include: { performedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  })

  if (!lead) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  res.json(lead)
})

router.post("/", async (req: Request, res: Response) => {
  const { fullName, phone, email, source, campaignName, learningFormat, branch, assignedToId, notes } = req.body

  if (!fullName || !phone) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Full name and phone are required" },
      requestId: req.requestId
    })
    return
  }

  const result = await leadService.createLead(
    { fullName, phone, email, source, campaignName, learningFormat, branch, assignedToId, notes },
    req.user!.userId
  )

  res.status(201).json(result)
})

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { fullName, phone, email, learningFormat, branch, nextFollowUpDate, notes } = req.body

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(fullName && { fullName }),
      ...(phone && { phone }),
      ...(email !== undefined && { email }),
      ...(learningFormat && { learningFormat }),
      ...(branch !== undefined && { branch }),
      ...(nextFollowUpDate !== undefined && {
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null
      }),
      ...(notes !== undefined && { notes })
    }
  })

  res.json(updated)
})

router.put("/:id/status", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { status, closedReason } = req.body

  if (!status) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Status is required" },
      requestId: req.requestId
    })
    return
  }

  if (status === "CLOSED" && closedReason) {
    await prisma.lead.update({
      where: { id },
      data: { closedReason }
    })
  }

  const updated = await leadService.updateLeadStatus(id, status, req.user!.userId)
  if (!updated) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  res.json(updated)
})

router.put("/:id/assign", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { assignedToId } = req.body

  if (!assignedToId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "assignedToId is required" },
      requestId: req.requestId
    })
    return
  }

  const updated = await leadService.assignLead(id, assignedToId, req.user!.userId)
  if (!updated) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead or staff not found" },
      requestId: req.requestId
    })
    return
  }

  res.json(updated)
})

router.post("/:id/convert", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { childName, childBirthYear, learningFormat, branch, groupId } = req.body

  if (!childName || !learningFormat) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "childName and learningFormat are required" },
      requestId: req.requestId
    })
    return
  }

  const result = await leadService.convertLead(
    id,
    { childName, childBirthYear, learningFormat, branch, groupId },
    req.user!.userId
  )

  if (!result) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  if ("error" in result) {
    res.status(409).json({
      error: { code: "ALREADY_CONVERTED", message: "Lead is already converted" },
      requestId: req.requestId
    })
    return
  }

  res.status(201).json(result)
})

router.post("/:id/reopen", async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  const result = await leadService.reopenLead(id, req.user!.userId)
  if (!result) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  if ("error" in result) {
    res.status(422).json({
      error: { code: "NOT_CLOSED", message: "Lead is not in CLOSED status" },
      requestId: req.requestId
    })
    return
  }

  res.json(result)
})

router.post("/:id/note", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { note } = req.body

  if (!note) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Note is required" },
      requestId: req.requestId
    })
    return
  }

  const updated = await leadService.addNote(id, note, req.user!.userId)
  if (!updated) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  res.json(updated)
})

export default router
