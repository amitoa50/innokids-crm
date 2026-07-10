import prisma from "../lib/prisma"

export interface CalendarEvent {
  id: string
  type: "TRIAL" | "GROUP" | "TASK" | "FOLLOW_UP"
  title: string
  start: string
  end?: string
  allDay: boolean
  entityType: string // LEAD, STUDENT, GROUP, TASK
  entityId: number
  overdue?: boolean
}

// Hebrew weekday name -> JS getDay() index (Sunday = 0). Group schedules store the
// day as a Hebrew name; used to expand a weekly group into concrete occurrences.
const HE_WEEKDAY: Record<string, number> = {
  "ראשון": 0,
  "שני": 1,
  "שלישי": 2,
  "רביעי": 3,
  "חמישי": 4,
  "שישי": 5,
  "שבת": 6
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface Params {
  from: Date
  to: Date
  staffId?: number // undefined = all staff (admin, unfiltered)
}

// Aggregates the four CRM sources into one normalized event list for a date range,
// optionally scoped to a single staff member. Times are treated as local (Israel).
export async function getCalendarEvents({ from, to, staffId }: Params): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = []

  // Trials — real timestamps, scoped by teacher
  const trials = await prisma.trialLesson.findMany({
    where: {
      scheduledAt: { gte: from, lte: to },
      status: { not: "CANCELLED" },
      ...(staffId ? { teacherId: staffId } : {})
    },
    include: { lead: { select: { id: true, fullName: true } } }
  })
  for (const t of trials) {
    const end = new Date(t.scheduledAt.getTime() + (t.durationMinutes ?? 45) * 60000)
    events.push({
      id: `trial-${t.id}`,
      type: "TRIAL",
      title: `ניסיון: ${t.lead?.fullName ?? "ליד"}`,
      start: t.scheduledAt.toISOString(),
      end: end.toISOString(),
      allDay: false,
      entityType: "LEAD",
      entityId: t.leadId
    })
  }

  // Group sessions — weekly recurring, expanded to concrete occurrences in range
  const groups = await prisma.group.findMany({
    where: {
      status: "ACTIVE",
      dayOfWeek: { not: null },
      ...(staffId ? { teacherId: staffId } : {})
    }
  })
  for (const g of groups) {
    const weekday = HE_WEEKDAY[g.dayOfWeek!]
    if (weekday === undefined) continue
    const startTime = g.startTime || "16:00"
    const cursor = new Date(from)
    cursor.setHours(0, 0, 0, 0)
    const last = new Date(to)
    while (cursor <= last) {
      if (cursor.getDay() === weekday) {
        const dateStr = ymd(cursor)
        events.push({
          id: `group-${g.id}-${dateStr}`,
          type: "GROUP",
          title: `קבוצה: ${g.name}`,
          start: `${dateStr}T${startTime}:00`,
          end: g.endTime ? `${dateStr}T${g.endTime}:00` : undefined,
          allDay: false,
          entityType: "GROUP",
          entityId: g.id
        })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  // Tasks — all-day on the due date, scoped by assignee
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: from, lte: to },
      ...(staffId ? { assignedToId: staffId } : {})
    }
  })
  for (const task of tasks) {
    const entityType = task.leadId ? "LEAD" : task.studentId ? "STUDENT" : "TASK"
    const entityId = task.leadId ?? task.studentId ?? task.id
    events.push({
      id: `task-${task.id}`,
      type: "TASK",
      title: `משימה: ${task.title}`,
      start: ymd(task.dueDate!),
      allDay: true,
      entityType,
      entityId
    })
  }

  // Lead follow-ups — all-day on the next follow-up date, scoped by assignee
  const now = new Date()
  const leads = await prisma.lead.findMany({
    where: {
      nextFollowUpDate: { gte: from, lte: to },
      status: { notIn: ["CLOSED", "CONVERTED"] },
      ...(staffId ? { assignedToId: staffId } : {})
    },
    select: { id: true, fullName: true, nextFollowUpDate: true }
  })
  for (const lead of leads) {
    events.push({
      id: `followup-${lead.id}`,
      type: "FOLLOW_UP",
      title: `מעקב: ${lead.fullName}`,
      start: ymd(lead.nextFollowUpDate!),
      allDay: true,
      entityType: "LEAD",
      entityId: lead.id,
      overdue: lead.nextFollowUpDate! < now
    })
  }

  return events
}
