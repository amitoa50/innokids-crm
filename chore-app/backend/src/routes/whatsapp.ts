import { Router, Request, Response } from "express"
import { getProvider } from "../services/whatsapp"
import * as inboundService from "../services/whatsapp/inbound.service"
const router = Router()

// Public webhook — authenticated by provider verify token / signature, not JWT.

router.get("/webhook", (req: Request, res: Response) => {
  const provider = getProvider()
  const challenge = provider.verifyChallenge(req.query as Record<string, unknown>)
  if (challenge !== null) {
    res.status(200).send(challenge)
    return
  }
  res.status(403).json({
    error: { code: "FORBIDDEN", message: "Verification failed" },
    requestId: req.requestId
  })
})

router.post("/webhook", async (req: Request, res: Response) => {
  const provider = getProvider()
  const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body)
  const signature = req.headers["x-hub-signature-256"] as string | undefined

  if (!provider.verifySignature(signature, rawBody)) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid signature" },
      requestId: req.requestId
    })
    return
  }

  const parsed = provider.parseWebhook(req.body as Record<string, unknown>)
  for (const m of parsed.inboundMessages) {
    await inboundService.handleInboundMessage(m)
  }
  for (const s of parsed.statusUpdates) {
    await inboundService.handleStatusUpdate(s)
  }

  res.status(200).json({ received: true, requestId: req.requestId })
})

export default router
