import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Lead, Group, User } from "../types"

interface Props {
  isOpen: boolean
  onClose: () => void
  defaultLeadId?: number
  defaultLeadName?: string
}

interface FormData {
  leadId: string
  groupId: string
  scheduledAt: string
  teacherId: string
  notes: string
  meetingUrl: string
}

export default function TrialLessonModal({ isOpen, onClose, defaultLeadId, defaultLeadName }: Props) {
  const queryClient = useQueryClient()
  const [changingLead, setChangingLead] = useState(false)

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      leadId: defaultLeadId?.toString() || "",
      groupId: "",
      teacherId: "",
      notes: "",
      meetingUrl: ""
    }
  })

  // Re-seed the form each time the modal opens so a launched-from-lead context
  // preselects (and locks) the right lead, even before the leads list loads.
  useEffect(() => {
    if (isOpen) {
      reset({
        leadId: defaultLeadId?.toString() || "",
        groupId: "",
        scheduledAt: "",
        teacherId: "",
        notes: "",
        meetingUrl: ""
      })
      setChangingLead(false)
    }
  }, [isOpen, defaultLeadId, reset])

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: async () => { const { data } = await client.get("/lead"); return data },
    enabled: isOpen
  })

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => { const { data } = await client.get("/group"); return data },
    enabled: isOpen
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => { const { data } = await client.get("/user"); return data },
    enabled: isOpen
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return client.post("/trial-lesson", {
        leadId: Number(data.leadId),
        groupId: data.groupId ? Number(data.groupId) : undefined,
        scheduledAt: data.scheduledAt,
        teacherId: data.teacherId ? Number(data.teacherId) : undefined,
        notes: data.notes || undefined,
        meetingUrl: data.meetingUrl || undefined
      })
    },
    onSuccess: () => {
      toast.success("שיעור ניסיון נקבע בהצלחה")
      queryClient.invalidateQueries({ queryKey: ["trialLessons"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      reset()
      onClose()
    },
    onError: () => {
      toast.error("שגיאה בקביעת שיעור ניסיון")
    }
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">שיעור ניסיון חדש</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ליד *</label>
            {defaultLeadId && !changingLead ? (
              <div className="flex items-center gap-2">
                <input type="hidden" {...register("leadId", { required: true })} />
                <div className="flex-1 border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                  {defaultLeadName || leads.find((l) => l.id === defaultLeadId)?.fullName || "ליד נבחר"}
                </div>
                <button
                  type="button"
                  onClick={() => setChangingLead(true)}
                  className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                >
                  שנה ליד
                </button>
              </div>
            ) : (
              <select {...register("leadId", { required: true })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="">בחר ליד...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.fullName} - {l.phone}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">תאריך ושעה *</label>
            <input
              {...register("scheduledAt", { required: true })}
              type="datetime-local"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">קבוצה</label>
              <select {...register("groupId")} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="">ללא</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">קישור לשיעור אונליין (זום)</label>
            <input
              {...register("meetingUrl")}
              type="url"
              dir="ltr"
              placeholder="https://zoom.us/j/..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">יישלח להורה בתזכורת האוטומטית שעה לפני השיעור</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">הערות</label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-start gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "שומר..." : "קבע שיעור ניסיון"}
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
