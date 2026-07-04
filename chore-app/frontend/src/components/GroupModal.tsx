import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Group, User } from "../types"

interface Props {
  isOpen: boolean
  onClose: () => void
  group?: Group | null
}

interface FormData {
  name: string
  type: string
  ageRange: string
  learningFormat: string
  branch: string
  dayOfWeek: string
  time: string
  maxCapacity: string
  teacherId: string
}

export default function GroupModal({ isOpen, onClose, group }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!group

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: group ? {
      name: group.name,
      type: group.type,
      ageRange: group.ageRange || "",
      learningFormat: group.learningFormat,
      branch: group.branch || "",
      dayOfWeek: group.dayOfWeek || "",
      time: group.time || "",
      maxCapacity: group.maxCapacity?.toString() || "",
      teacherId: group.teacherId?.toString() || ""
    } : {
      learningFormat: "ONLINE"
    }
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const { data } = await client.get("/user"); return data },
    enabled: isOpen
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const body = {
        name: data.name,
        type: data.type,
        ageRange: data.ageRange || undefined,
        learningFormat: data.learningFormat,
        branch: data.branch || undefined,
        dayOfWeek: data.dayOfWeek || undefined,
        time: data.time || undefined,
        maxCapacity: data.maxCapacity ? Number(data.maxCapacity) : undefined,
        teacherId: data.teacherId ? Number(data.teacherId) : undefined
      }

      if (isEdit) return client.put(`/group/${group.id}`, body)
      return client.post("/group", body)
    },
    onSuccess: () => {
      toast.success(isEdit ? "קבוצה עודכנה" : "קבוצה נוצרה בהצלחה")
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      reset()
      onClose()
    },
    onError: () => {
      toast.error("שגיאה בשמירת הקבוצה")
    }
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            {isEdit ? "עריכת קבוצה" : "קבוצה חדשה"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">שם הקבוצה *</label>
              <input
                {...register("name", { required: true })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סוג תוכנית *</label>
              <input
                {...register("type", { required: true })}
                placeholder="Scratch, Python, Robotics..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">טווח גילאים</label>
              <input
                {...register("ageRange")}
                placeholder="8-10"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">פורמט *</label>
              <select {...register("learningFormat", { required: true })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="ONLINE">מקוון</option>
                <option value="IN_PERSON">פרונטלי</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">יום</label>
              <select {...register("dayOfWeek")} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="">—</option>
                <option value="ראשון">ראשון</option>
                <option value="שני">שני</option>
                <option value="שלישי">שלישי</option>
                <option value="רביעי">רביעי</option>
                <option value="חמישי">חמישי</option>
                <option value="שישי">שישי</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">שעה</label>
              <input
                {...register("time")}
                type="time"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">קיבולת</label>
              <input
                {...register("maxCapacity")}
                type="number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סניף</label>
              <input
                {...register("branch")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">מורה</label>
              <select {...register("teacherId")} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="">ללא</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-start gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "שומר..." : isEdit ? "עדכון" : "צור קבוצה"}
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
