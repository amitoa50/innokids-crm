import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import prisma from "../lib/prisma"
import { getJwtSecret } from "../lib/jwtSecret"
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
    getJwtSecret(),
    { expiresIn: "7d" }
  )

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    requestId: req.requestId
  })
})

export default router
