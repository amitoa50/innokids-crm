import { Router, Request, Response } from "express"
import { authenticate } from "../middleware/auth"
import { getCalendarEvents } from "../services/calendar.service"
const router = Router()

router.use(authenticate)

router.get("/", async (req: Request, res: Response) => {
  const { from, to, staffId } = req.query

  if (!from || !to) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "from and to are required" },
      requestId: req.requestId
    })
    return
  }

  const fromDate = new Date(from as string)
  const toDate = new Date(to as string)
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "from and to must be valid dates" },
      requestId: req.requestId
    })
    return
  }

  // Per-staff scope: STAFF is locked to their own events; ADMIN may pass a specific
  // staffId, or omit it (or "all") to see the whole team.
  let effectiveStaffId: number | undefined
  if (req.user!.role === "ADMIN") {
    effectiveStaffId = staffId && staffId !== "all" ? Number(staffId) : undefined
  } else {
    effectiveStaffId = req.user!.userId
  }

  const events = await getCalendarEvents({ from: fromDate, to: toDate, staffId: effectiveStaffId })
  res.json(events)
})

export default router
