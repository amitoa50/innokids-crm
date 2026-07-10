import { describe, it, expect, beforeEach } from "vitest"
import { getCalendarEvents } from "../src/services/calendar.service"
import { prisma, resetDb, createLead } from "./helpers/db"

// Fixed two-week window in July 2026 (contains "now" per the project date).
const FROM = new Date("2026-07-06T00:00:00.000Z")
const TO = new Date("2026-07-20T00:00:00.000Z")

let staffCounter = 0
async function createStaff(name: string) {
  staffCounter += 1
  return prisma.user.create({
    data: { email: `staff${staffCounter}@t.local`, name, password: "x", role: "STAFF" }
  })
}

beforeEach(async () => {
  await resetDb()
})

describe("calendar.service getCalendarEvents", () => {
  it("returns all four event types in range", async () => {
    const staff = await createStaff("מורה")
    const lead = await createLead({ assignedToId: staff.id, nextFollowUpDate: new Date("2026-07-10T00:00:00.000Z") })
    await prisma.trialLesson.create({
      data: { leadId: lead.id, scheduledAt: new Date("2026-07-08T14:00:00.000Z"), status: "SCHEDULED", teacherId: staff.id }
    })
    await prisma.group.create({
      data: { name: "ק", type: "Scratch", learningFormat: "ONLINE", status: "ACTIVE", dayOfWeek: "שלישי", startTime: "17:00", endTime: "18:00", teacherId: staff.id }
    })
    await prisma.task.create({
      data: { title: "משימה", assignedToId: staff.id, dueDate: new Date("2026-07-09T00:00:00.000Z") }
    })

    const events = await getCalendarEvents({ from: FROM, to: TO })
    const types = new Set(events.map((e) => e.type))

    expect(types.has("TRIAL")).toBe(true)
    expect(types.has("GROUP")).toBe(true)
    expect(types.has("TASK")).toBe(true)
    expect(types.has("FOLLOW_UP")).toBe(true)
  })

  it("expands a weekly group onto the correct weekday with its start time", async () => {
    await prisma.group.create({
      data: { name: "ק", type: "Scratch", learningFormat: "ONLINE", status: "ACTIVE", dayOfWeek: "שלישי", startTime: "17:00", endTime: "18:00" }
    })

    const groupEvents = (await getCalendarEvents({ from: FROM, to: TO })).filter((e) => e.type === "GROUP")

    expect(groupEvents.length).toBeGreaterThan(0)
    for (const e of groupEvents) {
      expect(new Date(e.start).getDay()).toBe(2) // שלישי = Tuesday
      expect(e.start).toContain("T17:00:00")
    }
  })

  it("scopes events to a single staff member", async () => {
    const a = await createStaff("A")
    const b = await createStaff("B")
    const leadA = await createLead({ assignedToId: a.id })
    await prisma.trialLesson.create({
      data: { leadId: leadA.id, scheduledAt: new Date("2026-07-08T14:00:00.000Z"), status: "SCHEDULED", teacherId: a.id }
    })
    await prisma.task.create({
      data: { title: "task-b", assignedToId: b.id, dueDate: new Date("2026-07-09T00:00:00.000Z") }
    })

    const forA = await getCalendarEvents({ from: FROM, to: TO, staffId: a.id })
    expect(forA.some((e) => e.type === "TRIAL")).toBe(true)
    expect(forA.some((e) => e.type === "TASK")).toBe(false) // task belongs to B

    const forAll = await getCalendarEvents({ from: FROM, to: TO })
    expect(forAll.some((e) => e.type === "TASK")).toBe(true)
  })

  it("flags an overdue follow-up", async () => {
    const staff = await createStaff("C")
    await createLead({ assignedToId: staff.id, status: "NEW", nextFollowUpDate: new Date("2026-07-07T00:00:00.000Z") })

    const fu = (await getCalendarEvents({ from: FROM, to: TO })).find((e) => e.type === "FOLLOW_UP")

    expect(fu?.overdue).toBe(true)
  })

  it("excludes CANCELLED trials and converted/closed lead follow-ups", async () => {
    const staff = await createStaff("D")
    const lead = await createLead({ assignedToId: staff.id, status: "CONVERTED", nextFollowUpDate: new Date("2026-07-10T00:00:00.000Z") })
    await prisma.trialLesson.create({
      data: { leadId: lead.id, scheduledAt: new Date("2026-07-08T14:00:00.000Z"), status: "CANCELLED", teacherId: staff.id }
    })

    const events = await getCalendarEvents({ from: FROM, to: TO })
    expect(events.some((e) => e.type === "TRIAL")).toBe(false)
    expect(events.some((e) => e.type === "FOLLOW_UP")).toBe(false)
  })
})
