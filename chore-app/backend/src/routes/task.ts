import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import * as taskService from "../services/task.service"
const router = Router()

router.use(authenticate)

router.get("/", async (req: Request, res: Response) => {
  const { status, assignedToId, type, priority, leadId, studentId } = req.query
  const tasks = await taskService.listTasks({
    status: status as string,
    assignedToId: assignedToId ? Number(assignedToId) : undefined,
    type: type as string,
    priority: priority as string,
    leadId: leadId ? Number(leadId) : undefined,
    studentId: studentId ? Number(studentId) : undefined
  })
  res.json(tasks)
})

router.post("/", async (req: Request, res: Response) => {
  const { title, assignedToId } = req.body

  if (!title || !assignedToId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "title and assignedToId are required" },
      requestId: req.requestId
    })
    return
  }

  const task = await taskService.createTask(req.body, req.user!.userId)
  res.status(201).json(task)
})

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const task = await taskService.updateTask(id, req.body)
  res.json(task)
})

router.put("/:id/complete", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const task = await taskService.completeTask(id, req.user!.userId)
  res.json(task)
})

router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  await taskService.deleteTask(id)
  res.json({ message: "Task deleted", requestId: req.requestId })
})

export default router
