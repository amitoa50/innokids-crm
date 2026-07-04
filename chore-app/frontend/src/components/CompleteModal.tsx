import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"

interface Props {
  isOpen: boolean
  onClose: () => void
  choreId: number
  choreTitle: string
  onSuccess?: () => void
}

interface FormData {
  notes: string
}

export default function CompleteModal({ isOpen, onClose, choreId, choreTitle, onSuccess }: Props) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset } = useForm<FormData>()

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return client.post(`/chores/${choreId}/complete`, { notes: data.notes || null })
    },
    onSuccess: () => {
      toast.success("התורנות סומנה כהושלמה!")
      queryClient.invalidateQueries({ queryKey: ["chores"] })
      queryClient.invalidateQueries({ queryKey: ["reports"] })
      reset()
      onSuccess?.()
      onClose()
    },
    onError: () => {
      toast.error("השלמת התורנות נכשלה")
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">השלמת תורנות</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            לסמן את <span className="font-semibold">{choreTitle}</span> כהושלמה?
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">הערות (אופציונלי)</label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="הערות על ההשלמה..."
            />
          </div>

          <div className="flex justify-start gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "משלים..." : "סמן כהושלם"}
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
