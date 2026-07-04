import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { TrialLesson } from "../types"
import StatusBadge from "../components/StatusBadge"
import TrialLessonModal from "../components/TrialLessonModal"

export default function TrialLessons() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")

  const { data: trials = [] } = useQuery<TrialLesson[]>({
    queryKey: ["trialLessons", statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : ""
      const { data } = await client.get(`/trial-lesson${params}`)
      return data
    }
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status, outcome }: { id: number; status: string; outcome?: string }) =>
      client.put(`/trial-lesson/${id}/status`, { status, outcome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trialLessons"] })
      toast.success("סטטוס עודכן")
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">שיעורי ניסיון</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          שיעור ניסיון חדש
        </button>
      </div>

      <div className="flex gap-2">
        {[
          { value: "", label: "הכל" },
          { value: "SCHEDULED", label: "מתוכננים" },
          { value: "COMPLETED", label: "הושלמו" },
          { value: "NO_SHOW", label: "לא הגיעו" },
          { value: "CANCELLED", label: "בוטלו" }
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === value
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">ליד</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">תאריך ושעה</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">קבוצה</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">מורה</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">סטטוס</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((trial) => (
              <tr key={trial.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">
                  {trial.lead?.fullName || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {new Date(trial.scheduledAt).toLocaleString("he-IL", {
                    dateStyle: "short", timeStyle: "short"
                  })}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{trial.group?.name || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{trial.teacher?.name || "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={trial.status} /></td>
                <td className="px-4 py-3">
                  {trial.status === "SCHEDULED" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => statusMutation.mutate({ id: trial.id, status: "COMPLETED" })}
                        className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100"
                      >
                        הושלם
                      </button>
                      <button
                        onClick={() => statusMutation.mutate({ id: trial.id, status: "NO_SHOW" })}
                        className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                      >
                        לא הגיע
                      </button>
                      <button
                        onClick={() => statusMutation.mutate({ id: trial.id, status: "CANCELLED" })}
                        className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
                      >
                        בטל
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {trials.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  אין שיעורי ניסיון להצגה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TrialLessonModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}
