import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import * as tagService from "../services/tag.service"
const router = Router()

router.use(authenticate)

router.get("/", async (_req: Request, res: Response) => {
  res.json(await tagService.listTags())
})

router.post("/", async (req: Request, res: Response) => {
  const { name, color } = req.body

  if (!name || !String(name).trim()) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "name is required" },
      requestId: req.requestId
    })
    return
  }

  const existing = await tagService.findTagByName(String(name).trim())
  if (existing) {
    res.status(409).json({
      error: { code: "TAG_EXISTS", message: "A tag with this name already exists" },
      requestId: req.requestId
    })
    return
  }

  const tag = await tagService.createTag(String(name).trim(), color)
  res.status(201).json(tag)
})

router.delete("/:id", async (req: Request, res: Response) => {
  await tagService.deleteTag(Number(req.params.id))
  res.json({ ok: true, requestId: req.requestId })
})

export default router
