import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import prisma from "../lib/prisma"
import * as leadService from "../services/lead.service"
import * as communicationService from "../services/communication.service"
import { sendWhatsApp } from "../services/whatsapp/send.service"
const router = Router()

const sendErrorStatus: Record<string, number> = {
  LEAD_NOT_FOUND: 404,
  NO_CONSENT: 409,
  WINDOW_CLOSED_NO_TEMPLATE: 422,
  TEMPLATE_NOT_APPROVED: 422,
  EMPTY_BODY: 400
}

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
  const { fullName, phone, email, source, campaignName, learningFormat, branch, assignedToId, notes, childName, childBirthYear, whatsappConsent, marketingConsent, preferredChannel } = req.body

  if (!fullName || !phone) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Full name and phone are required" },
      requestId: req.requestId
    })
    return
  }

  const result = await leadService.createLead(
    { fullName, phone, email, source, campaignName, learningFormat, branch, assignedToId, notes, childName, childBirthYear, whatsappConsent, marketingConsent, preferredChannel },
    req.user!.userId
  )

  res.status(201).json(result)
})

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { fullName, phone, email, learningFormat, branch, nextFollowUpDate, notes, childName, childBirthYear, whatsappConsent, marketingConsent, preferredChannel } = req.body

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
      ...(notes !== undefined && { notes }),
      ...(childName !== undefined && { childName }),
      ...(childBirthYear !== undefined && { childBirthYear }),
      ...(whatsappConsent !== undefined && {
        whatsappConsent,
        whatsappConsentAt: whatsappConsent ? (lead.whatsappConsentAt ?? new Date()) : null
      }),
      ...(marketingConsent !== undefined && { marketingConsent }),
      ...(preferredChannel !== undefined && { preferredChannel })
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

  const result = await leadService.updateLeadStatus(id, status, req.user!.userId)
  if (!result) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  if ("error" in result) {
    res.status(409).json({
      error: {
        code: "INVALID_TRANSITION",
        message: `Cannot move lead from ${result.from} to ${result.to}`,
        details: { from: result.from, to: result.to }
      },
      requestId: req.requestId
    })
    return
  }

  res.json(result)
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
    if (result.error === "GROUP_NOT_FOUND") {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Group not found" },
        requestId: req.requestId
      })
      return
    }
    if (result.error === "GROUP_FULL") {
      res.status(409).json({
        error: { code: "GROUP_FULL", message: "Group is at full capacity" },
        requestId: req.requestId
      })
      return
    }
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

router.get("/:id/conversation", async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  const conversations = await communicationService.getLeadConversations(id)
  res.json(conversations)
})

router.post("/:id/message", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { channel, direction, body } = req.body

  if (!channel || !direction || !body) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "channel, direction, and body are required" },
      requestId: req.requestId
    })
    return
  }

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Lead not found" },
      requestId: req.requestId
    })
    return
  }

  // WhatsApp outbound goes through the provider (consent + window enforced);
  // every other channel/direction is logged only.
  if (channel === "WHATSAPP" && direction === "OUTBOUND") {
    const result = await sendWhatsApp(id, { body, templateName: req.body.templateName, variables: req.body.variables }, req.user!.userId)
    if ("error" in result && result.error) {
      const code = result.error
      res.status(sendErrorStatus[code] || 400).json({
        error: { code, message: `WhatsApp send rejected: ${code}` },
        requestId: req.requestId
      })
      return
    }
    res.status(201).json(result.message)
    return
  }

  const conversation = await communicationService.getOrCreateConversation({ leadId: id }, channel)
  const message = await communicationService.logMessage(
    { conversationId: conversation.id, direction, channel, body, sentById: req.user!.userId },
    req.user!.userId
  )

  res.status(201).json(message)
})

export default router
