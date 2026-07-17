import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { getJwtSecret } from "../lib/jwtSecret"
import prisma from "../lib/prisma"

interface JwtPayload {
  userId: number
  email: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "No token provided" },
      requestId: req.requestId
    })
    return
  }

  const token = authHeader.split(" ")[1]
  let decoded: JwtPayload
  try {
    decoded = jwt.verify(token, getJwtSecret()) as JwtPayload
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
      requestId: req.requestId
    })
    return
  }

  // Re-check against the DB so deactivation and role changes take effect
  // immediately instead of surviving until the 7-day token expires
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
  if (!user || user.status !== "ACTIVE") {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Account is inactive" },
      requestId: req.requestId
    })
    return
  }

  req.user = { userId: user.id, email: user.email, role: user.role }
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Admin access required" },
      requestId: req.requestId
    })
    return
  }
  next()
}
