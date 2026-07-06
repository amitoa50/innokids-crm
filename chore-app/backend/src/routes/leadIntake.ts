import { Router, Request, Response } from "express"
import { authenticate, requireAdmin } from "../middleware/auth"
import { validateApiKey } from "../middleware/apiKey"
import prisma from "../lib/prisma"
import * as leadService from "../services/lead.service"
import * as externalRefService from "../services/externalRef.service"
import { normalize as facebookNormalize } from "../services/normalizer/facebook"
import { normalize as instagramNormalize } from "../services/normalizer/instagram"
import { normalize as websiteNormalize } from "../services/normalizer/website"
import { normalize as defaultNormalize } from "../services/normalizer/default"
const router = Router()

const normalizers: Record<string, (payload: Record<string, unknown>) => ReturnType<typeof defaultNormalize>> = {
  facebook: facebookNormalize,
  instagram: instagramNormalize,
  website: websiteNormalize
}

router.post("/webhook/:source", validateApiKey, async (req: Request, res: Response) => {
  const source = (req.params.source as string).toLowerCase()
  const payload = req.body

  // Always log raw payload first
  const intake = await prisma.leadIntake.create({
    data: {
      source,
      rawPayload: JSON.stringify(payload),
      status: "PENDING"
    }
  })

  const normalizer = normalizers[source] || defaultNormalize
  const normalized = normalizer(payload)

  if (!normalized.phone) {
    await prisma.leadIntake.update({
      where: { id: intake.id },
      data: { status: "FAILED", errorMessage: "Phone number is missing" }
    })

    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Phone number is required" },
      requestId: req.requestId
    })
    return
  }

  const system = source.toUpperCase()

  // External-ID idempotency: a replayed external event returns the same lead
  if (normalized.externalId) {
    const existingRef = await externalRefService.findByExternalId(system, normalized.externalId)
    if (existingRef) {
      await prisma.leadIntake.update({
        where: { id: intake.id },
        data: { status: "DUPLICATE_EXTERNAL", leadId: existingRef.entityId }
      })

      res.status(200).json({
        status: "DUPLICATE_EXTERNAL",
        leadId: existingRef.entityId,
        requestId: req.requestId
      })
      return
    }
  }

  const result = await leadService.createLead({
    fullName: normalized.fullName,
    phone: normalized.phone,
    email: normalized.email,
    source: system,
    campaignName: normalized.campaignName,
    learningFormat: normalized.learningFormat,
    branch: normalized.branch
  })

  if (normalized.externalId) {
    await externalRefService.linkExternalId({
      entityType: "LEAD",
      entityId: result.lead.id,
      system,
      externalId: normalized.externalId,
      metadata: { source, action: result.action }
    })
  }

  await prisma.leadIntake.update({
    where: { id: intake.id },
    data: {
      status: result.action,
      leadId: result.lead.id
    }
  })

  res.status(201).json({
    status: result.action,
    leadId: result.lead.id,
    requestId: req.requestId
  })
})

router.get("/log", authenticate, requireAdmin, async (req: Request, res: Response) => {
  const logs = await prisma.leadIntake.findMany({
    include: { lead: { select: { fullName: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  })

  res.json(logs)
})

export default router
