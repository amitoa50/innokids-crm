import { describe, it, expect, beforeEach } from "vitest"
import { convertLead, updateLeadStatus, setLeadStatus } from "../src/services/lead.service"
import { createTag, findTagByName, deleteTag, listTags } from "../src/services/tag.service"
import { prisma, resetDb, createAdmin, createLead } from "./helpers/db"

beforeEach(async () => {
  await resetDb()
  await prisma.tag.deleteMany()
})

describe("flexible conversion (feature 2)", () => {
  it("converts a lead into a FULL group without blocking", async () => {
    const admin = await createAdmin()
    const lead = await createLead()
    const group = await prisma.group.create({
      data: { name: "מלאה", type: "Scratch", learningFormat: "ONLINE", maxCapacity: 0 }
    })

    const result = await convertLead(
      lead.id,
      { childName: "ילד", learningFormat: "ONLINE", groupId: group.id },
      admin.id
    )

    expect("error" in result!).toBe(false)
    if (!result || "error" in result) return
    expect(result.student.groupId).toBe(group.id)
    // group flips to FULL for display, but the conversion still went through
    expect((await prisma.group.findUnique({ where: { id: group.id } }))!.status).toBe("FULL")
  })

  it("creates a new group inline during conversion", async () => {
    const admin = await createAdmin()
    const lead = await createLead()

    const result = await convertLead(
      lead.id,
      {
        childName: "ילד",
        learningFormat: "IN_PERSON",
        newGroup: { name: "קבוצה חדשה", type: "Python", learningFormat: "IN_PERSON", maxCapacity: 8 }
      },
      admin.id
    )

    expect("error" in result!).toBe(false)
    if (!result || "error" in result) return
    expect(result.student.groupId).toBeTruthy()
    const group = await prisma.group.findUnique({ where: { id: result.student.groupId! } })
    expect(group?.name).toBe("קבוצה חדשה")
  })

  it("still rejects a genuinely missing group id", async () => {
    const admin = await createAdmin()
    const lead = await createLead()

    const result = await convertLead(
      lead.id,
      { childName: "ילד", learningFormat: "ONLINE", groupId: 999999 },
      admin.id
    )

    expect(result && "error" in result && result.error).toBe("GROUP_NOT_FOUND")
  })
})

describe("free manual status transitions (feature 4a)", () => {
  it("allows an otherwise-illegal manual move", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ status: "NEW" })

    const result = await updateLeadStatus(lead.id, "FOLLOW_UP_AFTER_TRIAL", admin.id)

    expect(result && "error" in result).toBe(false)
    expect((await prisma.lead.findUnique({ where: { id: lead.id } }))!.status).toBe("FOLLOW_UP_AFTER_TRIAL")
  })

  it("still guards the transition map for non-forced (system) callers", async () => {
    const admin = await createAdmin()
    const lead = await createLead({ status: "NEW" })

    const result = await setLeadStatus(lead.id, "CONVERTED", admin.id)

    expect(result && "error" in result && result.error).toBe("INVALID_TRANSITION")
  })
})

describe("free-form tags (feature 4b)", () => {
  it("creates, finds, assigns, filters and deletes tags", async () => {
    const lead = await createLead()

    const tag = await createTag("חם", "#ef4444")
    expect(tag.id).toBeTruthy()
    expect((await findTagByName("חם"))?.id).toBe(tag.id)
    expect((await listTags()).some((t) => t.name === "חם")).toBe(true)

    await prisma.lead.update({ where: { id: lead.id }, data: { tags: { connect: { id: tag.id } } } })
    const tagged = await prisma.lead.findMany({ where: { tags: { some: { id: tag.id } } } })
    expect(tagged.some((l) => l.id === lead.id)).toBe(true)

    await deleteTag(tag.id)
    expect(await findTagByName("חם")).toBeNull()
  })

  it("deleteTag is a no-op for a missing id (does not throw)", async () => {
    await expect(deleteTag(987654)).resolves.toBeUndefined()
  })
})
