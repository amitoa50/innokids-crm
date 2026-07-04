import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import { authenticate, requireAdmin } from "../middleware/auth"
import prisma from "../lib/prisma"
const router = Router()

router.use(authenticate)
router.use(requireAdmin)

router.get("/", async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true }
  })
  res.json(users)
})

router.post("/", async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body

  if (!email || !password || !name) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Email, password, and name are required" },
      requestId: req.requestId
    })
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Email already in use" },
      requestId: req.requestId
    })
    return
  }

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      role: role || "STAFF"
    },
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true }
  })

  res.status(201).json(user)
})

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { name, role, status } = req.body

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "User not found" },
      requestId: req.requestId
    })
    return
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(role && { role }),
      ...(status && { status })
    },
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true }
  })

  res.json(user)
})

router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  if (id === req.user!.userId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Cannot delete yourself" },
      requestId: req.requestId
    })
    return
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "User not found" },
      requestId: req.requestId
    })
    return
  }

  await prisma.user.delete({ where: { id } })
  res.json({ message: "User deleted", requestId: req.requestId })
})

export default router
