import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Tag } from "../types"

function chipStyle(color: string | null) {
  const c = color || "#64748b"
  return { backgroundColor: `${c}22`, color: c, borderColor: `${c}55` }
}

// Read-only chips for lists/cards.
export function TagChips({ tags }: { tags: Tag[] }) {
  if (!tags.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={chipStyle(tag.color)}
        >
          {tag.name}
        </span>
      ))}
    </div>
  )
}

export default function TagPicker({ leadId, tags }: { leadId: number; tags: Tag[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState("")

  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: async () => { const { data } = await client.get("/tag"); return data },
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["lead"] })
    qc.invalidateQueries({ queryKey: ["leads"] })
  }

  const addMut = useMutation({
    mutationFn: (tagId: number) => client.post(`/lead/${leadId}/tag`, { tagId }),
    onSuccess: invalidate,
    onError: () => toast.error("שגיאה בהוספת תגית"),
  })

  const removeMut = useMutation({
    mutationFn: (tagId: number) => client.delete(`/lead/${leadId}/tag/${tagId}`),
    onSuccess: invalidate,
    onError: () => toast.error("שגיאה בהסרת תגית"),
  })

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await client.post("/tag", { name })
      return data as Tag
    },
    onSuccess: (tag) => {
      setNewName("")
      qc.invalidateQueries({ queryKey: ["tags"] })
      addMut.mutate(tag.id)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { code?: string } } } }
      toast.error(e.response?.data?.error?.code === "TAG_EXISTS" ? "תגית בשם הזה כבר קיימת" : "שגיאה ביצירת תגית")
    },
  })

  const available = allTags.filter((t) => !tags.some((lt) => lt.id === t.id))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
          style={chipStyle(tag.color)}
        >
          {tag.name}
          <button
            onClick={() => removeMut.mutate(tag.id)}
            className="hover:opacity-70"
            title="הסר תגית"
          >
            <X size={12} />
          </button>
        </span>
      ))}

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
        >
          <Plus size={12} />
          תגית
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <div className="max-h-40 overflow-y-auto space-y-1">
              {available.length === 0 && (
                <p className="px-1 py-1 text-xs text-slate-400">אין תגיות נוספות</p>
              )}
              {available.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => { addMut.mutate(tag.id); setOpen(false) }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-right text-xs hover:bg-slate-50"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color || "#64748b" }} />
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createMut.mutate(newName.trim()) }}
                placeholder="תגית חדשה…"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                onClick={() => newName.trim() && createMut.mutate(newName.trim())}
                disabled={!newName.trim() || createMut.isPending}
                className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                צור
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
