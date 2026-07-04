import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import { useAuth } from "../hooks/useAuth"
import type { Chore } from "../types"
import ChoreModal from "../components/ChoreModal"
import CompleteModal from "../components/CompleteModal"

type StatusFilter = "ALL" | "PENDING" | "COMPLETED" | "OVERDUE"

const statusColors: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
}

const statusLabels: Record<string, string> = {
  PENDING: "ממתין",
  COMPLETED: "הושלם",
  OVERDUE: "באיחור",
}

const filterLabels: Record<StatusFilter, string> = {
  ALL: "הכל",
  PENDING: "ממתין",
  COMPLETED: "הושלם",
  OVERDUE: "באיחור",
}

const recurrenceLabels: Record<string, string> = {
  NONE: "חד פעמי",
  DAILY: "יומי",
  WEEKLY: "שבועי",
  MONTHLY: "חודשי",
}

export default function Chores() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<StatusFilter>("ALL")
  const [choreModalOpen, setChoreModalOpen] = useState(false)
  const [editingChore, setEditingChore] = useState<Chore | null>(null)
  const [completingChore, setCompletingChore] = useState<Chore | null>(null)

  const { data: chores = [], isLoading } = useQuery<Chore[]>({
    queryKey: ["chores"],
    queryFn: async () => {
      const { data } = await client.get("/chores")
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.delete(`/chores/${id}`),
    onSuccess: () => {
      toast.success("התורנות נמחקה")
      queryClient.invalidateQueries({ queryKey: ["chores"] })
    },
    onError: () => toast.error("מחיקת התורנות נכשלה"),
  })

  const filtered = filter === "ALL" ? chores : chores.filter((c) => c.status === filter)

  const filters: StatusFilter[] = ["ALL", "PENDING", "COMPLETED", "OVERDUE"]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">תורנויות</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingChore(null)
              setChoreModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            תורנות חדשה
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">טוען תורנויות...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">לא נמצאו תורנויות</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">כותרת</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">מוקצה ל</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">תאריך יעד</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">תדירות</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">סטטוס</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((chore) => (
                <tr key={chore.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-slate-800">{chore.title}</div>
                    {chore.description && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{chore.description}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{chore.assignedTo?.name ?? "לא מוקצה"}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {new Date(chore.dueDate).toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{recurrenceLabels[chore.recurrence] ?? chore.recurrence}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[chore.status] ?? ""}`}>
                      {statusLabels[chore.status] ?? chore.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      {chore.status !== "COMPLETED" && (
                        <button
                          onClick={() => setCompletingChore(chore)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="סמן כהושלם"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setEditingChore(chore)
                              setChoreModalOpen(true)
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="ערוך"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("למחוק את התורנות?")) {
                                deleteMutation.mutate(chore.id)
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="מחק"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ChoreModal
        isOpen={choreModalOpen}
        onClose={() => {
          setChoreModalOpen(false)
          setEditingChore(null)
        }}
        chore={editingChore}
      />

      {completingChore && (
        <CompleteModal
          isOpen={!!completingChore}
          onClose={() => setCompletingChore(null)}
          choreId={completingChore.id}
          choreTitle={completingChore.title}
        />
      )}
    </div>
  )
}
