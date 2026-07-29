import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, createAdmin, createLead, prisma } from "./helpers/db"
import { notifyOverdueFollowUps } from "../src/services/followUp.service"

beforeEach(async () => {
  await resetDb()
})

describe("notifyOverdueFollowUps", () => {
  it("notifies once for a newly-overdue lead", async () => {
    const admin = await createAdmin()
    const lead = await createLead({
      assignedToId: admin.id,
      nextFollowUpDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
    })

    const notified = await notifyOverdueFollowUps()

    expect(notified).toBe(1)
    const notifications = await prisma.notification.findMany({ where: { userId: admin.id } })
    expect(notifications).toHaveLength(1)
    expect(notifications[0].message).toContain(lead.fullName)
  })

  it("does not duplicate an unread notification for the same lead on a second run", async () => {
    const admin = await createAdmin()
    await createLead({
      assignedToId: admin.id,
      nextFollowUpDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
    })

    await notifyOverdueFollowUps()
    const secondRun = await notifyOverdueFollowUps()

    expect(secondRun).toBe(0)
    const notifications = await prisma.notification.findMany({ where: { userId: admin.id } })
    expect(notifications).toHaveLength(1)
  })

  it("re-notifies once the previous notification has been read", async () => {
    const admin = await createAdmin()
    await createLead({
      assignedToId: admin.id,
      nextFollowUpDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
    })

    await notifyOverdueFollowUps()
    await prisma.notification.updateMany({ where: { userId: admin.id }, data: { read: true } })
    const secondRun = await notifyOverdueFollowUps()

    expect(secondRun).toBe(1)
    const notifications = await prisma.notification.findMany({ where: { userId: admin.id } })
    expect(notifications).toHaveLength(2)
  })

  it("skips CLOSED and CONVERTED leads", async () => {
    const admin = await createAdmin()
    await createLead({
      assignedToId: admin.id,
      status: "CLOSED",
      nextFollowUpDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
    })

    const notified = await notifyOverdueFollowUps()

    expect(notified).toBe(0)
  })

  it("skips leads with no assigned staff member", async () => {
    await createLead({
      nextFollowUpDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
    })

    const notified = await notifyOverdueFollowUps()

    expect(notified).toBe(0)
  })
})
