import { Router, Request, Response } from "express"
import { authenticate, requireAdmin } from "../middleware/auth"
import * as groupService from "../services/group.service"
const router = Router()

router.use(authenticate)

router.get("/", async (req: Request, res: Response) => {
  const { status, learningFormat, branch } = req.query
  const groups = await groupService.listGroups({
    status: status as string,
    learningFormat: learningFormat as string,
    branch: branch as string
  })
  res.json(groups)
})

router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const group = await groupService.getGroup(id)

  if (!group) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Group not found" },
      requestId: req.requestId
    })
    return
  }

  res.json(group)
})

router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { name, type, learningFormat } = req.body

  if (!name || !type || !learningFormat) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "name, type, and learningFormat are required" },
      requestId: req.requestId
    })
    return
  }

  const group = await groupService.createGroup(req.body)
  res.status(201).json(group)
})

router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const group = await groupService.updateGroup(id, req.body)
  res.json(group)
})

router.post("/:id/student", async (req: Request, res: Response) => {
  const groupId = Number(req.params.id)
  const { studentId, allowOverfill } = req.body

  if (!studentId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "studentId is required" },
      requestId: req.requestId
    })
    return
  }

  const result = await groupService.addStudentToGroup(groupId, studentId, !!allowOverfill)

  if ("error" in result) {
    if (result.error === "GROUP_NOT_FOUND") {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Group not found" },
        requestId: req.requestId
      })
      return
    }
    res.status(409).json({
      error: { code: "GROUP_FULL", message: "Group is at full capacity" },
      requestId: req.requestId
    })
    return
  }

  res.json(result.student)
})

router.delete("/:id/student/:studentId", async (req: Request, res: Response) => {
  const groupId = Number(req.params.id)
  const studentId = Number(req.params.studentId)
  const result = await groupService.removeStudentFromGroup(groupId, studentId)

  if ("error" in result) {
    const missing = result.error === "STUDENT_NOT_FOUND"
    res.status(missing ? 404 : 409).json({
      error: {
        code: result.error,
        message: missing ? "Student not found" : "Student is not a member of this group"
      },
      requestId: req.requestId
    })
    return
  }

  res.json(result.student)
})

export default router
