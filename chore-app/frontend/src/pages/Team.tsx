import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { UserPlus, Trash2, X, Shield, User as UserIcon } from "lucide-react"
import { toast } from "sonner"
import client from "../api/client"
import type { User } from "../types"

interface AddMemberForm {
  name: string
  email: string
  password: string
  role: "ADMIN" | "STAFF"
}

export default function Team() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await client.get("/user")
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.delete(`/user/${id}`),
    onSuccess: () => {
      toast.success("חבר הצוות הוסר")
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: () => toast.error("הסרת חבר הצוות נכשלה"),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">צוות</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <UserPlus size={16} />
          הוסף חבר צוות
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">טוען צוות...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-slate-400">אין חברי צוות</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${user.role === "ADMIN" ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-600"}`}>
                  {user.role === "ADMIN" ? <Shield size={20} /> : <UserIcon size={20} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                  <span
                    className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === "ADMIN"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {user.role === "ADMIN" ? "מנהל" : "צוות"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm(`להסיר את ${user.name} מהצוות?`)) {
                    deleteMutation.mutate(user.id)
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="הסר חבר צוות"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <AddMemberModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<AddMemberForm>({
    defaultValues: { role: "STAFF" },
  })

  const mutation = useMutation({
    mutationFn: async (data: AddMemberForm) => {
      return client.post("/user", data)
    },
    onSuccess: () => {
      toast.success("חבר צוות נוסף")
      queryClient.invalidateQueries({ queryKey: ["users"] })
      onClose()
    },
    onError: () => toast.error("הוספת חבר צוות נכשלה"),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">הוספת חבר צוות</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">שם *</label>
            <input
              {...register("name", { required: "שם הוא שדה חובה" })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="שם מלא"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">אימייל *</label>
            <input
              type="email"
              {...register("email", { required: "אימייל הוא שדה חובה" })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="member@office.local"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">סיסמה *</label>
            <input
              type="password"
              {...register("password", { required: "סיסמה היא שדה חובה", minLength: { value: 6, message: "מינימום 6 תווים" } })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="מינימום 6 תווים"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">תפקיד</label>
            <select
              {...register("role")}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="STAFF">צוות</option>
              <option value="ADMIN">מנהל</option>
            </select>
          </div>

          <div className="flex justify-start gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "מוסיף..." : "הוסף חבר"}
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
