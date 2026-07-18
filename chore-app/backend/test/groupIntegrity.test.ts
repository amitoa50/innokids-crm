import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import app from "../src/app"
import { addStudentToGroup } from "../src/services/group.service"
import { updateStudent } from "../src/services/student.service"
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

describe("group status consistency (T7)", () => {
  it("transfer refreshes the old group back to ACTIVE", async () => {
    await createAdmin()
    const { group: full, student } = await createStudentInGroup("מלאה", 1)
    await prisma.group.update({ where: { id: full.id }, data: { status: "FULL" } })
    const target = await prisma.group.create({
      data: { name: "יעד", type: "Python", learningFormat: "ONLINE", maxCapacity: 8 }
    })

    const result = await addStudentToGroup(target.id, student.id)

    expect("student" in result).toBe(true)
    const oldAfter = await prisma.group.findUnique({ where: { id: full.id } })
    expect(oldAfter!.status).toBe("ACTIVE")
  })

  it("direct student edit into a full group is rejected", async () => {
    await createAdmin()
    const { group: full } = await createStudentInGroup("מלאה", 1)
    const { student: other } = await createStudentInGroup("אחרת")

    const result = await updateStudent(other.id, { groupId: full.id })

    expect(result).toEqual({ error: "GROUP_FULL" })
    const after = await prisma.student.findUnique({ where: { id: other.id } })
    expect(after!.groupId).not.toBe(full.id)
  })

  it("direct student edit refreshes both groups' status", async () => {
    await createAdmin()
    const { group: old, student } = await createStudentInGroup("ישנה", 1)
    await prisma.group.update({ where: { id: old.id }, data: { status: "FULL" } })
    const target = await prisma.group.create({
      data: { name: "חדשה", type: "Python", learningFormat: "ONLINE", maxCapacity: 1 }
    })

    const result = await updateStudent(student.id, { groupId: target.id })

    expect(result && "error" in result!).toBe(false)
    expect((await prisma.group.findUnique({ where: { id: old.id } }))!.status).toBe("ACTIVE")
    expect((await prisma.group.findUnique({ where: { id: target.id } }))!.status).toBe("FULL")
  })
})
