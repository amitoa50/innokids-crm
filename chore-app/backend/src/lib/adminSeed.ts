import bcrypt from "bcryptjs"
import prisma from "./prisma"

// Seed the initial admin when the user table is empty. Credentials come from
// ADMIN_EMAIL/ADMIN_PASSWORD; the well-known dev default is never created in
// production — an operator must supply real credentials there.
export async function seedAdmin() {
  const userCount = await prisma.user.count()
  if (userCount > 0) return

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (email && password) {
    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: { email, name: "Admin", password: hashed, role: "ADMIN" }
    })
    console.log(`Seeded admin user from ADMIN_EMAIL: ${email}`)
    return
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "No users exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set — refusing to seed the default dev admin in production. Set both variables and restart to create the first admin."
    )
    return
  }

  const hashed = await bcrypt.hash("admin123", 10)
  await prisma.user.create({
    data: { email: "admin@office.local", name: "Admin", password: hashed, role: "ADMIN" }
  })
  console.warn("Seeded DEV-ONLY default admin: admin@office.local / admin123 — do not use in production")
}
