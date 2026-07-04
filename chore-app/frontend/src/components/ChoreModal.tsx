import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Chore, User } from "../types"

interface ChoreFormData {
  title: string
  description: string
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY"
  dueDate: string
  assignedToId: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  chore?: Chore | null
  onSuccess?: () => void
}

export default function ChoreModal({ isOpen, onClose, chore, onSuccess }: Props) {
  const queryClient = useQueryClient()

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await client.get("/users")
      return data
    },
    enabled: isOpen,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChoreFormData>()

  useEffect(() => {
    if (isOpen) {
      if (chore) {
        reset({
          title: chore.title,
          description: chore.description ?? "",
          recurrence: chore.recurrence,
          dueDate: chore.dueDate.slice(0, 10),
          assignedToId: String(chore.assignedToId),
        })
      } else {
        reset({
          title: "",
          description: "",
          recurrence: "NONE",
          dueDate: "",
          assignedToId: "",
        })
      }
    }
  }, [isOpen, chore, reset])

  const mutation = useMutation({
    mutationFn: async (formData: ChoreFormData) => {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        recurrence: formData.recurrence,
        dueDate: formData.dueDate,
        assignedToId: Number(formData.assignedToId),
      }
      if (chore) {
        return client.put(`/chores/${chore.id}`, payload)
      }
      return client.post("/chores", payload)
    },
    onSuccess: () => {
      toast.success(chore ? "התורנות עודכנה" : "התורנות נוצרה")
      queryClient.invalidateQueries({ queryKey: ["chores"] })
      onSuccess?.()
      onClose()
    },
    onError: () => {
      toast.error("שמירת התורנות נכשלה")
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            {chore ? "עריכת תורנות" : "תורנות חדשה"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">כותרת *</label>
            <input
              {...register("title", { required: "כותרת היא שדה חובה" })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="לדוגמה: ניקיון מטבח"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">תיאור</label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="פרטים נוספים..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">תדירות</label>
              <select
                {...register("recurrence")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="NONE">חד פעמי</option>
                <option value="DAILY">יומי</option>
                <option value="WEEKLY">שבועי</option>
                <option value="MONTHLY">חודשי</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">תאריך יעד *</label>
              <input
                type="date"
                {...register("dueDate", { required: "תאריך יעד הוא שדה חובה" })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">הקצה ל *</label>
            <select
              {...register("assignedToId", { required: "יש לבחור חבר צוות" })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">בחר חבר צוות</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            {errors.assignedToId && <p className="text-red-500 text-xs mt-1">{errors.assignedToId.message}</p>}
          </div>

          <div className="flex justify-start gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "שומר..." : chore ? "עדכן" : "צור"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
