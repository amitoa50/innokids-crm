import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import cron from "node-cron"
import bcrypt from "bcryptjs"
import prisma from "./lib/prisma"

import authRoutes from "./routes/auth"
import choreRoutes from "./routes/chores"
import userRoutes from "./routes/users"
import reportRoutes from "./routes/reports"
import notificationRoutes from "./routes/notifications"
const app = express()

app.use(cors({ origin: "http://localhost:5173" }))
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/chores", choreRoutes)
app.use("/api/users", userRoutes)
app.use("/api/reports", reportRoutes)
app.use("/api/notifications", notificationRoutes)

// Daily cron job at midnight: mark overdue chores and notify assignees
cron.schedule("0 0 * * *", async () => {
  try {
    const now = new Date()
    const overdueChores = await prisma.chore.findMany({
      where: {
        status: "PENDING",
        dueDate: { lt: now }
      }
    })

    for (const chore of overdueChores) {
      await prisma.chore.update({
        where: { id: chore.id },
        data: { status: "OVERDUE" }
      })

      await prisma.notification.create({
        data: {
          message: `Chore overdue: ${chore.title}`,
          userId: chore.assignedToId
        }
      })
    }

    if (overdueChores.length > 0) {
      console.log(`Marked ${overdueChores.length} chore(s) as overdue`)
    }
  } catch (err) {
    console.error("Cron job error:", err)
  }
})

// Seed admin user on startup
async function seedAdmin() {
  const userCount = await prisma.user.count()
  if (userCount === 0) {
    const hashed = await bcrypt.hash("admin123", 10)
    await prisma.user.create({
      data: {
        email: "admin@office.local",
        name: "Admin",
        password: hashed,
        role: "ADMIN"
      }
    })
    console.log("Seeded default admin user: admin@office.local / admin123")
  }
}

const PORT = 4000

seedAdmin()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error("Failed to seed admin:", err)
    process.exit(1)
  })
