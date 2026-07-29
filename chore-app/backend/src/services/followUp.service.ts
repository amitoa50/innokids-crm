import prisma from "../lib/prisma"

// Extracted from the daily cron job so it's directly testable. Dedups against
// an already-unread notification for the same lead (identical message) so a
// lead that stays overdue for N days doesn't spam N identical notifications —
// once the assignee reads it, the next run notifies again.
export async function notifyOverdueFollowUps(now: Date = new Date()): Promise<number> {
  const overdueLeads = await prisma.lead.findMany({
    where: {
      nextFollowUpDate: { lt: now },
      status: { notIn: ["CLOSED", "CONVERTED"] },
      assignedToId: { not: null }
    }
  })

  let notified = 0
  for (const lead of overdueLeads) {
    if (!lead.assignedToId) continue
    const message = `מעקב באיחור: ${lead.fullName} (${lead.phone})`
    const existing = await prisma.notification.findFirst({
      where: { userId: lead.assignedToId, message, read: false }
    })
    if (existing) continue
    await prisma.notification.create({ data: { message, userId: lead.assignedToId } })
    notified += 1
  }
  return notified
}
