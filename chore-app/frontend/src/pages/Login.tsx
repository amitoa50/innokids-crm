import { useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ClipboardList } from "lucide-react"
import { useAuth } from "../hooks/useAuth"
import client from "../api/client"

interface LoginForm {
  email: string
  password: string
  name: string
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      if (isRegister) {
        await client.post("/auth/register", {
          email: data.email,
          password: data.password,
          name: data.name,
        })
        toast.success("החשבון נוצר בהצלחה! מתחבר...")
      }
      await login(data.email, data.password)
      toast.success("ברוך הבא!")
      navigate("/")
    } catch {
      toast.error(isRegister ? "ההרשמה נכשלה" : "פרטי התחברות שגויים")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-xl mb-4">
            <ClipboardList className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">מנהל תורנויות</h1>
          <p className="text-slate-500 text-sm mt-1">ניהול תורנויות משרדיות</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-5">
            {isRegister ? "יצירת חשבון" : "התחברות"}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">שם</label>
                <input
                  {...register("name", isRegister ? { required: "שם הוא שדה חובה" } : {})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="השם שלך"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">אימייל</label>
              <input
                type="email"
                {...register("email", { required: "אימייל הוא שדה חובה" })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@office.local"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סיסמה</label>
              <input
                type="password"
                {...register("password", { required: "סיסמה היא שדה חובה" })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="הזן סיסמה"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? "אנא המתן..." : isRegister ? "צור חשבון" : "התחבר"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              {isRegister ? "כבר יש לך חשבון? התחבר" : "אין לך חשבון? הירשם"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
