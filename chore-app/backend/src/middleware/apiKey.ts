import { Request, Response, NextFunction } from "express"

export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string

  if (!apiKey) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "API key is required" },
      requestId: req.requestId
    })
    return
  }

  const expectedKey = process.env.WEBHOOK_API_KEY
  if (!expectedKey || apiKey !== expectedKey) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid API key" },
      requestId: req.requestId
    })
    return
  }

  next()
}
