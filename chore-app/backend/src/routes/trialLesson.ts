import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import * as trialService from "../services/trialLesson.service"
const router = Router()

router.use(authenticate)

router.get("/", async (req: Request, res: Response) => {
  const { status, teacherId, from, to } = req.query
  const trials = await trialService.listTrialLessons({
    status: status as string,
    teacherId: teacherId ? Number(teacherId) : undefined,
    from: from as string,
    to: to as string
  })
  res.json(trials)
})

router.post("/", async (req: Request, res: Response) => {
  const { leadId, scheduledAt } = req.body

  if (!leadId || !scheduledAt) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "leadId and scheduledAt are required" },
      requestId: req.requestId
    })
    return
  }

  const result = await trialService.createTrialLesson(req.body, req.user!.userId)

  if (result && "error" in result) {
    const status = result.error === "LEAD_NOT_FOUND" ? 404 : result.error === "TRIAL_IN_PAST" ? 400 : 409
    res.status(status).json({
      error: { code: result.error, message: `Trial creation rejected: ${result.error}` },
      requestId: req.requestId
    })
    return
  }

  res.status(201).json(result)
})

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const result = await trialService.updateTrialLesson(id, req.body)

  if (!result) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Trial lesson not found" },
      requestId: req.requestId
    })
    return
  }

  if ("error" in result) {
    res.status(400).json({
      error: { code: result.error, message: `Trial update rejected: ${result.error}` },
      requestId: req.requestId
    })
    return
  }

  res.json(result)
})

router.put("/:id/status", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { status, outcome } = req.body

  if (!status) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Status is required" },
      requestId: req.requestId
    })
    return
  }

  const trial = await trialService.updateTrialStatus(id, status, outcome, req.user!.userId)

  if (!trial) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Trial lesson not found" },
      requestId: req.requestId
    })
    return
  }

  res.json(trial)
})

export default router
