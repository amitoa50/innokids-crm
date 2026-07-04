import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import prisma from "../lib/prisma"
const router = Router()

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Email and password are required" },
      requestId: req.requestId
    })
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
      requestId: req.requestId
    })
    return
  }

  if (user.status !== "ACTIVE") {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Account is inactive" },
      requestId: req.requestId
    })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
      requestId: req.requestId
    })
    return
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  )

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    requestId: req.requestId
  })
})

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, name } = req.body

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
    data: { email, password: hashed, name }
  })

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  )

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    requestId: req.requestId
  })
})

export default router
