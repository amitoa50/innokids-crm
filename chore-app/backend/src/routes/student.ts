import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import * as studentService from "../services/student.service"
const router = Router()

router.use(authenticate)

router.get("/", async (req: Request, res: Response) => {
  const { status, groupId, learningFormat, search } = req.query
  const students = await studentService.listStudents({
    status: status as string,
    groupId: groupId ? Number(groupId) : undefined,
    learningFormat: learningFormat as string,
    search: search as string
  })
  res.json(students)
})

router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const student = await studentService.getStudent(id)

  if (!student) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Student not found" },
      requestId: req.requestId
    })
    return
  }

  res.json(student)
})

router.post("/", async (req: Request, res: Response) => {
  const { leadId, childName, childBirthYear, learningFormat, branch, groupId, notes } = req.body

  if (!leadId || !childName || !learningFormat) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "leadId, childName, and learningFormat are required" },
      requestId: req.requestId
    })
    return
  }

  const student = await studentService.createStudent({
    leadId, childName, childBirthYear, learningFormat, branch, groupId, notes
  })

  if ("error" in student) {
    res.status(409).json({
      error: { code: "LEAD_ALREADY_CONVERTED", message: "A student already exists for this lead" },
      requestId: req.requestId
    })
    return
  }

  res.status(201).json(student)
})

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const student = await studentService.updateStudent(id, req.body)

  if (!student) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Student not found" },
      requestId: req.requestId
    })
    return
  }

  if ("error" in student) {
    const missing = student.error === "GROUP_NOT_FOUND"
    res.status(missing ? 404 : 409).json({
      error: {
        code: student.error,
        message: missing ? "Group not found" : "Group is at full capacity"
      },
      requestId: req.requestId
    })
    return
  }

  res.json(student)
})

export default router
