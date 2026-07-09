import prisma from "../lib/prisma"

export async function listTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } })
}

export async function findTagByName(name: string) {
  return prisma.tag.findUnique({ where: { name } })
}

export async function createTag(name: string, color?: string) {
  return prisma.tag.create({ data: { name, color } })
}

// deleteMany avoids throwing when the id doesn't exist; the join rows are removed
// automatically by the implicit many-to-many relation.
export async function deleteTag(id: number) {
  await prisma.tag.deleteMany({ where: { id } })
}

const DEFAULT_TAGS = [
  { name: "תפוצה", color: "#6366f1" },
  { name: "מעקב", color: "#f59e0b" },
  { name: "חם", color: "#ef4444" },
  { name: "לא רלוונטי כרגע", color: "#64748b" },
  { name: "הורה חוזר", color: "#10b981" }
]

// Idempotent — seeds a few starter tags on first boot; never overwrites existing ones.
export async function seedTags() {
  for (const t of DEFAULT_TAGS) {
    const existing = await prisma.tag.findUnique({ where: { name: t.name } })
    if (!existing) await prisma.tag.create({ data: t })
  }
  console.log(`Seeded default tags (${DEFAULT_TAGS.length})`)
}
