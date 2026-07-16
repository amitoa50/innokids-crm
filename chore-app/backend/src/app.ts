import express from "express"
import cors from "cors"
import path from "path"
import fs from "fs"
import { requestIdMiddleware } from "./lib/requestId"

import authRoutes from "./routes/auth"
import leadRoutes from "./routes/lead"
import leadIntakeRoutes from "./routes/leadIntake"
import studentRoutes from "./routes/student"
import groupRoutes from "./routes/group"
import trialLessonRoutes from "./routes/trialLesson"
import taskRoutes from "./routes/task"
import reportRoutes from "./routes/report"
import userRoutes from "./routes/user"
import notificationRoutes from "./routes/notification"
import whatsappRoutes from "./routes/whatsapp"
import automationRoutes from "./routes/automation"
import tagRoutes from "./routes/tag"
import calendarRoutes from "./routes/calendar"

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }))
app.use(express.json({ verify: (req, _res, buf) => { (req as express.Request).rawBody = buf } }))
app.use(requestIdMiddleware)

app.get("/api/health", (req, res) => {
  res.json({ ok: true, requestId: req.requestId })
})

app.use("/api/auth", authRoutes)
app.use("/api/lead", leadRoutes)
app.use("/api/lead-intake", leadIntakeRoutes)
app.use("/api/student", studentRoutes)
app.use("/api/group", groupRoutes)
app.use("/api/trial-lesson", trialLessonRoutes)
app.use("/api/task", taskRoutes)
app.use("/api/report", reportRoutes)
app.use("/api/user", userRoutes)
app.use("/api/notification", notificationRoutes)
app.use("/api/whatsapp", whatsappRoutes)
app.use("/api/automation", automationRoutes)
app.use("/api/tag", tagRoutes)
app.use("/api/calendar", calendarRoutes)

// Production: serve the built frontend from the same service (relative /api
// keeps working, no CORS). Skipped in dev, where Vite serves the frontend.
const frontendDist = path.resolve(__dirname, "../../frontend/dist")
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"))
  })
}

// Last-resort error handler: keep the JSON error contract even for unhandled
// throws (Express v5 forwards async errors here natively)
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[${req.requestId}] Unhandled error:`, err)
  res.status(500).json({
    error: { code: "INTERNAL", message: "Internal server error" },
    requestId: req.requestId
  })
})

export default app
