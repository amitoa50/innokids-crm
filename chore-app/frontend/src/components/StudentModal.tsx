import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { X, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { Group } from "../types"

interface Props {
  isOpen: boolean
  onClose: () => void
  leadId: number
  leadName: string
}

interface FormData {
  childName: string
  childBirthYear: string
  learningFormat: string
  branch: string
  groupId: string
  newGroupName: string
  newGroupType: string
  newGroupDay: string
  newGroupStartTime: string
  newGroupCapacity: string
}

const NEW_GROUP = "__new__"

export default function StudentModal({ isOpen, onClose, leadId, leadName }: Props) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, watch } = useForm<FormData>({
    defaultValues: { learningFormat: "ONLINE", newGroupType: "" }
  })

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => { const { data } = await client.get("/group"); return data },
    enabled: isOpen
  })

  const groupId = watch("groupId")
  const learningFormat = watch("learningFormat")
  const isNewGroup = groupId === NEW_GROUP
  const selectedGroup = groups.find((g) => String(g.id) === groupId)
  const selectedFull =
    !!selectedGroup &&
    selectedGroup.maxCapacity != null &&
    (selectedGroup._count?.students ?? 0) >= selectedGroup.maxCapacity

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return client.post(`/lead/${leadId}/convert`, {
        childName: data.childName,
        childBirthYear: data.childBirthYear ? Number(data.childBirthYear) : undefined,
        learningFormat: data.learningFormat,
        branch: data.branch || undefined,
        groupId: !isNewGroup && data.groupId ? Number(data.groupId) : undefined,
        newGroup: isNewGroup
          ? {
              name: data.newGroupName,
              type: data.newGroupType || "כללי",
              learningFormat: data.learningFormat,
              dayOfWeek: data.newGroupDay || undefined,
              startTime: data.newGroupStartTime || undefined,
              maxCapacity: data.newGroupCapacity ? Number(data.newGroupCapacity) : undefined
            }
          : undefined
      })
    },
    onSuccess: () => {
      toast.success("ליד הומר לתלמיד בהצלחה!")
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["lead"] })
      reset()
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { code?: string } } } }
      if (e.response?.data?.error?.code === "ALREADY_CONVERTED") {
        toast.error("הליד כבר הומר לתלמיד")
      } else {
        toast.error("שגיאה בהמרת הליד")
      }
    }
  })

  function onSubmit(data: FormData) {
    if (isNewGroup && !data.newGroupName.trim()) {
      toast.error("יש להזין שם לקבוצה החדשה")
      return
    }
    mutation.mutate(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">המרת ליד לתלמיד</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            המרת הליד <span className="font-semibold">{leadName}</span> לתלמיד רשום
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">שם הילד/ה *</label>
              <input
                {...register("childName", { required: true })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">שנת לידה</label>
              <input
                {...register("childBirthYear")}
                type="number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">פורמט למידה *</label>
              <select {...register("learningFormat", { required: true })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="ONLINE">מקוון</option>
                <option value="IN_PERSON">פרונטלי</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סניף</label>
              <input
                {...register("branch")}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">שיוך לקבוצה</label>
            <select {...register("groupId")} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              <option value="">ללא</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.maxCapacity != null ? ` (${g._count?.students ?? 0}/${g.maxCapacity})` : ""}
                </option>
              ))}
              <option value={NEW_GROUP}>➕ קבוצה חדשה…</option>
            </select>
          </div>

          {selectedFull && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>הקבוצה מלאה לפי הקיבולת שהוגדרה — עדיין ניתן לשייך, ההחלטה שלך.</span>
            </div>
          )}

          {isNewGroup && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">פרטי הקבוצה החדשה</p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">שם הקבוצה *</label>
                <input
                  {...register("newGroupName")}
                  placeholder="למשל: Scratch יום ג׳ 17:00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">תחום</label>
                  <input
                    {...register("newGroupType")}
                    placeholder="Scratch, Python, רובוטיקה…"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">קיבולת</label>
                  <input
                    {...register("newGroupCapacity")}
                    type="number"
                    placeholder="למשל 10"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">יום</label>
                  <select {...register("newGroupDay")} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option value="">—</option>
                    <option value="ראשון">ראשון</option>
                    <option value="שני">שני</option>
                    <option value="שלישי">שלישי</option>
                    <option value="רביעי">רביעי</option>
                    <option value="חמישי">חמישי</option>
                    <option value="שישי">שישי</option>
                    <option value="שבת">שבת</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">שעת התחלה</label>
                  <input
                    {...register("newGroupStartTime")}
                    type="time"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">הקבוצה תיווצר בפורמט {learningFormat === "IN_PERSON" ? "פרונטלי" : "מקוון"}. אפשר לערוך שאר הפרטים אחר כך במסך הקבוצות.</p>
            </div>
          )}

          <div className="flex justify-start gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "ממיר..." : "המר לתלמיד"}
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
