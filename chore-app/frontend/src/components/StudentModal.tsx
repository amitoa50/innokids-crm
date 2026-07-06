import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
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
}

export default function StudentModal({ isOpen, onClose, leadId, leadName }: Props) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: { learningFormat: "ONLINE" }
  })

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => { const { data } = await client.get("/group"); return data },
    enabled: isOpen
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return client.post(`/lead/${leadId}/convert`, {
        childName: data.childName,
        childBirthYear: data.childBirthYear ? Number(data.childBirthYear) : undefined,
        learningFormat: data.learningFormat,
        branch: data.branch || undefined,
        groupId: data.groupId ? Number(data.groupId) : undefined
      })
    },
    onSuccess: () => {
      toast.success("ליד הומר לתלמיד בהצלחה!")
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["lead"] })
      reset()
      onClose()
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { code?: string } } } }
      if (e.response?.data?.error?.code === "GROUP_FULL") {
        toast.error("הקבוצה מלאה — לא ניתן לשייך")
      } else if (e.response?.data?.error?.code === "ALREADY_CONVERTED") {
        toast.error("הליד כבר הומר לתלמיד")
      } else {
        toast.error("שגיאה בהמרת הליד")
      }
    }
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">המרת ליד לתלמיד</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-5 space-y-4">
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
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

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
