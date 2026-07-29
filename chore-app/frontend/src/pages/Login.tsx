import { useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { GraduationCap } from "lucide-react"
import { useAuth } from "../hooks/useAuth"

interface LoginForm {
  email: string
  password: string
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      toast.success("ברוך הבא!")
      navigate("/dashboard")
    } catch {
      toast.error("פרטי התחברות שגויים")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-nav-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[var(--color-gold)] rounded-xl mb-4">
            <GraduationCap className="text-[var(--color-nav-bg)]" size={28} />
          </div>
          <h1 className="text-2xl font-[var(--font-serif)] font-semibold text-white">INNOKIDS</h1>
          <p className="text-[var(--color-nav-text)] text-sm mt-1">מערכת ניהול לידים ותלמידים</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-[var(--font-serif)] font-semibold text-[var(--color-text-primary)] mb-5">התחברות</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">אימייל</label>
              <input
                type="email"
                {...register("email", { required: "אימייל הוא שדה חובה" })}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent"
                placeholder="you@innokids.co.il"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סיסמה</label>
              <input
                type="password"
                {...register("password", { required: "סיסמה היא שדה חובה" })}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent"
                placeholder="הזן סיסמה"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn--primary w-full py-2.5"
            >
              {loading ? "אנא המתן..." : "התחבר"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
