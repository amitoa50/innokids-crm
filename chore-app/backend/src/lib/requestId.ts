import { Request, Response, NextFunction } from "express"
import { v4 as uuidv4 } from "uuid"

declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = uuidv4()
  req.requestId = id
  res.setHeader("x-request-id", id)
  next()
}
