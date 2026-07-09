import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import cron from "node-cron"
import path from "path"
import fs from "fs"
import prisma from "./lib/prisma"
import { requestIdMiddleware } from "./lib/requestId"
import { setLeadStatus } from "./services/lead.service"
import { enqueue, dispatchDue } from "./services/automation.service"
import { seedAdmin } from "./lib/adminSeed"
import { seedAutomation } from "./lib/automationSeed"
import { NO_RESPONSE_AGING_DAYS } from "./lib/pipeline"

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
import { seedTags } from "./services/tag.service"

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

// Production: serve the built frontend from the same service (relative /api
// keeps working, no CORS). Skipped in dev, where Vite serves the frontend.
const frontendDist = path.resolve(__dirname, "../../frontend/dist")
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"))
  })
}

// Daily cron job at midnight: check overdue follow-ups and notify staff
cron.schedule("0 0 * * *", async () => {
  try {
    const now = new Date()
    const overdueLeads = await prisma.lead.findMany({
      where: {
        nextFollowUpDate: { lt: now },
        status: {
          notIn: ["CLOSED", "CONVERTED"]
        },
        assignedToId: { not: null }
      }
    })

    for (const lead of overdueLeads) {
      if (lead.assignedToId) {
        await prisma.notification.create({
          data: {
            message: `מעקב באיחור: ${lead.fullName} (${lead.phone})`,
            userId: lead.assignedToId
          }
        })
      }
    }

    if (overdueLeads.length > 0) {
      console.log(`Notified about ${overdueLeads.length} overdue follow-up(s)`)
    }

    // Auto-stage: advance completed-trial leads with a passed follow-up date to FOLLOW_UP_AFTER_TRIAL
    const postTrialLeads = await prisma.lead.findMany({
      where: {
        status: "TRIAL_COMPLETED",
        nextFollowUpDate: { lt: now }
      }
    })
    for (const lead of postTrialLeads) {
      await setLeadStatus(lead.id, "FOLLOW_UP_AFTER_TRIAL", undefined, { system: true })
    }

    // Auto-stage: age stale NEW/CONTACTED leads (follow-up passed by N days) to NO_RESPONSE
    const agingThreshold = new Date(now.getTime() - NO_RESPONSE_AGING_DAYS * 24 * 60 * 60 * 1000)
    const staleLeads = await prisma.lead.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED"] },
        nextFollowUpDate: { lt: agingThreshold }
      }
    })
    for (const lead of staleLeads) {
      await setLeadStatus(lead.id, "NO_RESPONSE", undefined, { system: true })
      const nudgeCtx = {
        leadId: lead.id,
        entityType: "LEAD",
        entityId: lead.id,
        baseTime: new Date(),
        parentName: lead.fullName
      }
      await enqueue("NO_RESPONSE_NUDGE", nudgeCtx)
      await enqueue("NO_RESPONSE_NUDGE_2", nudgeCtx)
      await enqueue("NO_RESPONSE_NUDGE_3", nudgeCtx)
    }
  } catch (err) {
    console.error("Cron job error:", err)
  }
})

// Automation dispatch tick: drain the ScheduledMessage outbox every 5 minutes.
// Gated by AUTOMATION_ENABLED; independent of the daily job above.
if (process.env.AUTOMATION_ENABLED === "true") {
  cron.schedule("*/5 * * * *", async () => {
    try {
      await dispatchDue()
    } catch (err) {
      console.error("Automation dispatch error:", err)
    }
  })
}

const PORT = Number(process.env.PORT) || 4000

seedAdmin()
  .then(() => seedAutomation())
  .then(() => seedTags())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error("Failed to seed:", err)
    process.exit(1)
  })
