import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Lead, User } from "../types"

interface Props {
  isOpen: boolean
  onClose: () => void
  lead?: Lead | null
}

interface FormData {
  fullName: string
  phone: string
  email: string
  source: string
  learningFormat: string
  branch: string
  assignedToId: string
  notes: string
  childName: string
  childBirthYear: string
  whatsappConsent: boolean
  preferredChannel: string
}

export default function LeadModal({ isOpen, onClose, lead }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!lead

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: lead ? {
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email || "",
      source: lead.source,
      learningFormat: lead.learningFormat || "",
      branch: lead.branch || "",
      assignedToId: lead.assignedToId?.toString() || "",
      notes: lead.notes || "",
      childName: lead.childName || "",
      childBirthYear: lead.childBirthYear?.toString() || "",
      whatsappConsent: lead.whatsappConsent || false,
      preferredChannel: lead.preferredChannel || ""
    } : {
      source: "MANUAL",
      learningFormat: "",
      assignedToId: "",
      childName: "",
      childBirthYear: "",
      whatsappConsent: false,
      preferredChannel: ""
    }
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await client.get("/user")
      return data
    },
    enabled: isOpen
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const body = {
        ...data,
        assignedToId: data.assignedToId ? Number(data.assignedToId) : undefined,
        email: data.email || undefined,
        learningFormat: data.learningFormat || undefined,
        branch: data.branch || undefined,
        notes: data.notes || undefined,
        childName: data.childName || undefined,
        childBirthYear: data.childBirthYear ? Number(data.childBirthYear) : undefined,
        whatsappConsent: data.whatsappConsent,
        preferredChannel: data.preferredChannel || undefined
      }

      if (isEdit) {
        return client.put(`/lead/${lead.id}`, body)
      }
      return client.post("/lead", body)
    },
    onSuccess: () => {
      toast.success(isEdit ? "ליד עודכן בהצלחה" : "ליד חדש נוצר בהצלחה")
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      reset()
      onClose()
    },
    onError: () => {
      toast.error(isEdit ? "עדכון הליד נכשל" : "יצירת הליד נכשלה")
    }
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            {isEdit ? "עריכת ליד" : "ליד חדש"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">שם מלא *</label>
              <input
                {...register("fullName", { required: true })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">טלפון *</label>
              <input
                {...register("phone", { required: true })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">אימייל</label>
            <input
              {...register("email")}
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">מקור</label>
              <select
                {...register("source")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="MANUAL">ידני</option>
                <option value="FACEBOOK">פייסבוק</option>
                <option value="INSTAGRAM">אינסטגרם</option>
                <option value="WEBSITE">אתר</option>
                <option value="OTHER">אחר</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">פורמט למידה</label>
              <select
                {...register("learningFormat")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">לא נבחר</option>
                <option value="ONLINE">מקוון</option>
                <option value="IN_PERSON">פרונטלי</option>
              </select>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">שיוך לאיש צוות</label>
              <select
                {...register("assignedToId")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">לא משויך</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">שם הילד/ה</label>
              <input
                {...register("childName")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">שנת לידה</label>
              <input
                {...register("childBirthYear")}
                type="number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ערוץ מועדף</label>
              <select
                {...register("preferredChannel")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">לא נבחר</option>
                <option value="WHATSAPP">וואטסאפ</option>
                <option value="PHONE">טלפון</option>
                <option value="EMAIL">אימייל</option>
              </select>
            </div>
            <label className="flex items-center gap-2 mt-6 text-sm font-medium text-slate-700">
              <input
                {...register("whatsappConsent")}
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              אישור יצירת קשר בוואטסאפ
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">הערות</label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-start gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "שומר..." : isEdit ? "עדכון" : "צור ליד"}
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
