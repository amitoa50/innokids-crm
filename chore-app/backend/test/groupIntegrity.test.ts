import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { prisma, resetDb, createAdmin, createLead } from "./helpers/db"
import { tokenFor } from "./helpers/auth"

beforeEach(async () => {
  await resetDb()
})

async function createStudentInGroup(groupName: string, maxCapacity = 8) {
  const lead = await createLead()
  const group = await prisma.group.create({
    data: { name: groupName, type: "Scratch", learningFormat: "ONLINE", maxCapacity }
  })
  const student = await prisma.student.create({
    data: { leadId: lead.id, childName: "ילד", learningFormat: "ONLINE", groupId: group.id }
  })
  return { group, student }
}

describe("remove student honors the group id (T6)", () => {
  it("rejects removal under the wrong group and keeps membership", async () => {
    const admin = await createAdmin()
    const { group, student } = await createStudentInGroup("קבוצה א")
    const otherGroup = await prisma.group.create({
      data: { name: "קבוצה ב", type: "Python", learningFormat: "ONLINE" }
    })

    const res = await request(app)
      .delete(`/api/group/${otherGroup.id}/student/${student.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("NOT_IN_GROUP")
    const after = await prisma.student.findUnique({ where: { id: student.id } })
    expect(after!.groupId).toBe(group.id)
  })

  it("removes under the correct group", async () => {
    const admin = await createAdmin()
    const { group, student } = await createStudentInGroup("קבוצה א")

    const res = await request(app)
      .delete(`/api/group/${group.id}/student/${student.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)

    expect(res.status).toBe(200)
    const after = await prisma.student.findUnique({ where: { id: student.id } })
    expect(after!.groupId).toBeNull()
  })

  it("returns 404 for a missing student", async () => {
    const admin = await createAdmin()
    const { group } = await createStudentInGroup("קבוצה א")

    const res = await request(app)
      .delete(`/api/group/${group.id}/student/999999`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("STUDENT_NOT_FOUND")
  })
})
