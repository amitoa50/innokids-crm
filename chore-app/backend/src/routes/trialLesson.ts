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

  const trial = await trialService.createTrialLesson(req.body, req.user!.userId)
  res.status(201).json(trial)
})

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const trial = await trialService.updateTrialLesson(id, req.body)
  res.json(trial)
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
  res.json(trial)
})

export default router
