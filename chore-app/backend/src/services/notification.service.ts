import prisma from "../lib/prisma"

export async function createNotification(userId: number, message: string) {
  return prisma.notification.create({
    data: { userId, message }
  })
}

export async function notifyAdmins(message: string) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" }
  })
  for (const admin of admins) {
    await createNotification(admin.id, message)
  }
}
