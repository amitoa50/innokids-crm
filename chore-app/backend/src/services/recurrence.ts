import prisma from "../lib/prisma"

export function calculateNextDueDate(currentDueDate: Date, recurrence: string): Date {
  const next = new Date(currentDueDate)
  switch (recurrence) {
    case "DAILY":
      next.setDate(next.getDate() + 1)
      break
    case "WEEKLY":
      next.setDate(next.getDate() + 7)
      break
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1)
      break
    default:
      break
  }
  return next
}

export async function createNextOccurrence(
  chore: {
    title: string
    description: string | null
    recurrence: string
    dueDate: Date
    assignedToId: number
  },
  createdById: number
) {
  const nextDueDate = calculateNextDueDate(chore.dueDate, chore.recurrence)
  return prisma.chore.create({
    data: {
      title: chore.title,
      description: chore.description,
      recurrence: chore.recurrence,
      dueDate: nextDueDate,
      status: "PENDING",
      assignedToId: chore.assignedToId,
      createdById
    }
  })
}
