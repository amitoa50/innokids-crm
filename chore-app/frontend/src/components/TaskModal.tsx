import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { User, Lead, Task } from "../types"

interface Props {
  isOpen: boolean
  onClose: () => void
  task?: Task | null
  defaultLeadId?: number
  defaultStudentId?: number
}

interface FormData {
  title: string
  description: string
  type: string
  priority: string
  dueDate: string
  assignedToId: string
  leadId: string
  studentId: string
}

export default function TaskModal({ isOpen, onClose, task, defaultLeadId, defaultStudentId }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!task

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: task ? {
      title: task.title,
      description: task.description || "",
      type: task.type,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      assignedToId: task.assignedToId.toString(),
      leadId: task.leadId?.toString() || "",
      studentId: task.studentId?.toString() || ""
    } : {
      type: "GENERAL",
      priority: "MEDIUM",
      leadId: defaultLeadId?.toString() || "",
      studentId: defaultStudentId?.toString() || ""
    }
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const { data } = await client.get("/user"); return data },
    enabled: isOpen
  })

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: async () => { const { data } = await client.get("/lead"); return data },
    enabled: isOpen
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const body = {
        title: data.title,
        description: data.description || undefined,
        type: data.type,
        priority: data.priority,
        dueDate: data.dueDate || undefined,
        assignedToId: Number(data.assignedToId),
        leadId: data.leadId ? Number(data.leadId) : undefined,
        studentId: data.studentId ? Number(data.studentId) : undefined
      }

      if (isEdit) return client.put(`/task/${task.id}`, body)
      return client.post("/task", body)
    },
    onSuccess: () => {
      toast.success(isEdit ? "משימה עודכנה" : "משימה נוצרה בהצלחה")
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      reset()
      onClose()
    },
    onError: () => {
      toast.error("שגיאה בשמירת המשימה")
    }
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            {isEdit ? "עריכת משימה" : "משימה חדשה"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">כותרת *</label>
            <input
              {...register("title", { required: true })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">תיאור</label>
            <textarea
              {...register("description")}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סוג</label>
              <select {...register("type")} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="GENERAL">כללי</option>
                <option value="FOLLOW_UP">מעקב</option>
                <option value="CALL">שיחה</option>
                <option value="TRIAL_REMINDER">תזכורת ניסיון</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">עדיפות</label>
              <select {...register("priority")} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="LOW">נמוכה</option>
                <option value="MEDIUM">בינונית</option>
                <option value="HIGH">גבוהה</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">תאריך יעד</label>
              <input
                {...register("dueDate")}
                type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">שיוך לאיש צוות *</label>
            <select {...register("assignedToId", { required: true })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              <option value="">בחר...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">קישור לליד</label>
            <select {...register("leadId")} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              <option value="">ללא</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.fullName}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-start gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "שומר..." : isEdit ? "עדכון" : "צור משימה"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
