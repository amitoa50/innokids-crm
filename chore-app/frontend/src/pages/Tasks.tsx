import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Task } from "../types"
import StatusBadge from "../components/StatusBadge"
import TaskModal from "../components/TaskModal"

export default function Tasks() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (typeFilter) params.set("type", typeFilter)
      const { data } = await client.get(`/task?${params}`)
      return data
    }
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) => client.put(`/task/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("משימה הושלמה")
    }
  })

  const isOverdue = (task: Task) =>
    task.dueDate && task.status === "PENDING" && new Date(task.dueDate) < new Date()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">משימות</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          משימה חדשה
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { value: "", label: "הכל" },
          { value: "PENDING", label: "ממתינות" },
          { value: "COMPLETED", label: "הושלמו" }
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
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">כל הסוגים</option>
          <option value="FOLLOW_UP">מעקב</option>
          <option value="CALL">שיחה</option>
          <option value="GENERAL">כללי</option>
          <option value="TRIAL_REMINDER">תזכורת ניסיון</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase w-8"></th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">כותרת</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">סוג</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">עדיפות</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">תאריך יעד</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">ליד/תלמיד</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">משויך ל</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className={`border-b border-slate-50 hover:bg-slate-50 ${isOverdue(task) ? "bg-red-50" : ""}`}>
                <td className="px-4 py-3">
                  {task.status === "PENDING" && (
                    <button
                      onClick={() => completeMutation.mutate(task.id)}
                      className="text-slate-400 hover:text-green-600 transition-colors"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                </td>
                <td className={`px-4 py-3 text-sm font-medium ${task.status === "COMPLETED" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                  {task.title}
                </td>
                <td className="px-4 py-3"><StatusBadge status={task.type} /></td>
                <td className="px-4 py-3"><StatusBadge status={task.priority} /></td>
                <td className={`px-4 py-3 text-sm ${isOverdue(task) ? "text-red-600 font-medium" : "text-slate-600"}`}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString("he-IL") : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {task.lead?.fullName || task.student?.childName || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {task.assignedTo?.name || "—"}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  אין משימות להצגה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TaskModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}
