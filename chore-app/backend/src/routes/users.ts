import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import { authenticate, requireAdmin } from "../middleware/auth"
import prisma from "../lib/prisma"
const router = Router()

router.use(authenticate)
router.use(requireAdmin)

// GET / — List all users
router.get("/", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  })
  res.json(users)
})

// POST / — Create new user (admin-initiated)
router.post("/", async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body

  if (!email || !password || !name) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Email, password, and name are required" } })
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Email already in use" } })
    return
  }

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      role: role || "MEMBER"
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  })

  res.status(201).json(user)
})

// DELETE /:id — Delete user (cannot delete self)
router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  if (id === req.user!.userId) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Cannot delete yourself" } })
    return
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } })
    return
  }

  await prisma.user.delete({ where: { id } })
  res.json({ message: "User deleted" })
})

export default router
